import { Router } from 'express'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin, requireChauffeur, requireClient } from '../../middleware/auth'
import { isOnline } from '../../realtime/presence'

const router = Router()

const VEHICLE_TYPES = ['CAR', 'SEDAN', 'SUV', 'MINIBUS', 'BUS'] as const

function toVehicle(v: any) {
  if (!v) return null
  return { id: v.id, type: v.type, seats: v.seats, plate_number: v.plateNumber }
}

function toChauffeur(c: any) {
  return {
    id: c.id,
    user: c.userId,
    vehicle: toVehicle(c.vehicle),
    is_verified: c.isVerified,
    is_available: c.isAvailable,
    photo: c.photo,
  }
}

// Admin listing view — adds the linked user's identity + live presence on top of toChauffeur().
function toChauffeurAdmin(c: any) {
  return {
    ...toChauffeur(c),
    username: c.user?.username,
    phone: c.user?.phone,
    is_online: isOnline(c.userId),
  }
}

function toLocationPing(p: any) {
  return { id: p.id, latitude: p.latitude, longitude: p.longitude, created_at: p.createdAt.toISOString() }
}

function toChauffeurAvailable(c: any) {
  return {
    id: c.id,
    phone: c.user?.phone,
    username: c.user?.username,
    vehicle: toVehicle(c.vehicle),
    is_available: c.isAvailable,
    latitude: c.latitude,
    longitude: c.longitude,
    photo: c.photo,
  }
}

// ---------- POST /apply/ ----------

const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  seats: z.number().int().positive(),
  plate_number: z.string().min(1),
})

router.post(
  '/apply/',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const existing = await prisma.chauffeur.findUnique({ where: { userId } })
    if (existing) return res.status(400).json({ detail: 'Chauffeur profile already exists.' })

    let vehicleId: number | undefined
    if (req.body?.vehicle) {
      const parsed = vehicleSchema.safeParse(req.body.vehicle)
      if (!parsed.success) return res.status(400).json(parsed.error.flatten())
      const vehicle = await prisma.vehicle.create({
        data: { type: parsed.data.type, seats: parsed.data.seats, plateNumber: parsed.data.plate_number },
      })
      vehicleId = vehicle.id
    }

    // isAvailable defaults to true (mirrors the Prisma schema default): being offline is meant
    // to be an explicit, exceptional action the chauffeur takes from their dashboard, not the
    // starting state of a new profile. isVerified stays false until an admin approves them —
    // note the driver socket (/ws/realtime/driver) already gates on isVerified regardless, so an
    // unverified-but-"available" chauffeur still won't broadcast a live position or get matched.
    const chauffeur = await prisma.chauffeur.create({
      data: { userId, vehicleId, isVerified: false, isAvailable: true },
      include: { vehicle: true },
    })
    await prisma.user.update({ where: { id: userId }, data: { role: 'CHAUFFEUR' } })

    return res.status(201).json(toChauffeur(chauffeur))
  }),
)

// ---------- GET/POST /vehicles/ (admin) ----------

router.get(
  '/vehicles/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({ orderBy: { id: 'asc' } })
    return res.json(vehicles.map(toVehicle))
  }),
)

router.post(
  '/vehicles/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = vehicleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const vehicle = await prisma.vehicle.create({
      data: { type: parsed.data.type, seats: parsed.data.seats, plateNumber: parsed.data.plate_number },
    })
    return res.status(201).json(toVehicle(vehicle))
  }),
)

// ---------- GET/POST /admin/chauffeurs/ (admin) ----------

const adminChauffeurSchema = z.object({
  user: z.number().int(),
  vehicle: z.number().int().nullable().optional(),
  is_verified: z.boolean().optional(),
  is_available: z.boolean().optional(),
})

router.get(
  '/admin/chauffeurs/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const chauffeurs = await prisma.chauffeur.findMany({ include: { vehicle: true, user: true }, orderBy: { id: 'asc' } })
    return res.json(chauffeurs.map(toChauffeurAdmin))
  }),
)

router.post(
  '/admin/chauffeurs/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminChauffeurSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data
    const chauffeur = await prisma.chauffeur.create({
      data: {
        userId: data.user,
        vehicleId: data.vehicle ?? undefined,
        isVerified: data.is_verified ?? false,
        isAvailable: data.is_available ?? true,
      },
      include: { vehicle: true },
    })
    return res.status(201).json(toChauffeur(chauffeur))
  }),
)

// ---------- PATCH/DELETE /admin/chauffeurs/:id/ (admin) ----------
// Gives the admin real management actions on a driver: (un)verify, suspend/reactivate
// (is_available — also used to gate the client-facing /available/ search), reassign
// vehicle, or fully revoke chauffeur status (demotes the account back to CLIENT).

const adminChauffeurUpdateSchema = z.object({
  vehicle: z.number().int().nullable().optional(),
  is_verified: z.boolean().optional(),
  is_available: z.boolean().optional(),
})

router.patch(
  '/admin/chauffeurs/:id/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid chauffeur id' })

    const parsed = adminChauffeurUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data

    const existing = await prisma.chauffeur.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ detail: 'Not found' })

    const chauffeur = await prisma.chauffeur.update({
      where: { id },
      data: {
        ...(data.vehicle !== undefined ? { vehicleId: data.vehicle } : {}),
        ...(data.is_verified !== undefined ? { isVerified: data.is_verified } : {}),
        ...(data.is_available !== undefined ? { isAvailable: data.is_available } : {}),
      },
      include: { vehicle: true, user: true },
    })
    return res.json(toChauffeurAdmin(chauffeur))
  }),
)

router.delete(
  '/admin/chauffeurs/:id/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid chauffeur id' })

    const existing = await prisma.chauffeur.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ detail: 'Not found' })

    await prisma.chauffeur.delete({ where: { id } })
    // Demote the underlying account back to CLIENT rather than deleting it — they keep
    // login access, they just lose chauffeur privileges until they re-apply.
    await prisma.user.update({ where: { id: existing.userId }, data: { role: 'CLIENT' } })

    return res.status(204).end()
  }),
)

// ---------- GET /available/?lat&lng&radius (client) ----------

router.get(
  '/available/',
  authenticate,
  requireClient,
  asyncHandler(async (req, res) => {
    const { lat, lng, radius } = req.query as Record<string, string | undefined>

    const where: any = { isVerified: true, isAvailable: true, latitude: { not: null }, longitude: { not: null } }

    if (lat && lng && radius) {
      const latN = parseFloat(lat)
      const lngN = parseFloat(lng)
      const radiusKm = parseFloat(radius)
      if (!Number.isNaN(latN) && !Number.isNaN(lngN) && !Number.isNaN(radiusKm)) {
        // approximate bounding box filter (1 degree ~111 km) — same approach as the Django view
        const delta = radiusKm / 111.0
        where.latitude = { gte: latN - delta, lte: latN + delta }
        where.longitude = { gte: lngN - delta, lte: lngN + delta }
      }
    }

    const chauffeurs = await prisma.chauffeur.findMany({ where, include: { vehicle: true, user: true } })
    return res.json(chauffeurs.map(toChauffeurAvailable))
  }),
)

// ---------- GET /:id/rating-summary/ ----------
// Average rating + review count for a chauffeur — shown to the passenger once a driver is
// found, before the ride starts, instead of only after the fact.

router.get(
  '/:id/rating-summary/',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid chauffeur id' })

    const agg = await prisma.tripRating.aggregate({
      where: { driverId: id, skipped: false },
      _avg: { rating: true },
      _count: { rating: true },
    })

    return res.json({
      average: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      count: agg._count.rating,
    })
  }),
)

// ---------- POST /location/ ----------

const locationSchema = z.object({
  latitude: z.union([z.number(), z.string()]),
  longitude: z.union([z.number(), z.string()]),
})

router.post(
  '/location/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = locationSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ detail: 'latitude and longitude required' })

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(400).json({ detail: 'No chauffeur profile' })

    const lat = Number(parsed.data.latitude)
    const lng = Number(parsed.data.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ detail: 'Invalid coordinates' })

    await prisma.chauffeur.update({ where: { id: chauffeur.id }, data: { latitude: lat, longitude: lng } })
    return res.json({ detail: 'Location updated' })
  }),
)

// ---------- POST /availability/ (chauffeur toggles online/offline) ----------

const availabilitySchema = z.object({ is_available: z.boolean() })

router.post(
  '/availability/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = availabilitySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(400).json({ detail: 'No chauffeur profile' })

    const updated = await prisma.chauffeur.update({
      where: { id: chauffeur.id },
      data: { isAvailable: parsed.data.is_available },
      include: { vehicle: true },
    })
    return res.json(toChauffeur(updated))
  }),
)

// ---------- GET /me/ (chauffeur — own profile) ----------

router.get(
  '/me/',
  authenticate,
  requireChauffeur,
  asyncHandler(async (req, res) => {
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id }, include: { vehicle: true } })
    if (!chauffeur) return res.status(404).json({ detail: 'No chauffeur profile' })
    return res.json(toChauffeur(chauffeur))
  }),
)

// ---------- POST /photo/ (chauffeur — own profile photo) ----------

const photoSchema = z.object({
  photo: z.string().min(1).nullable(),
})

router.post(
  '/photo/',
  authenticate,
  requireChauffeur,
  asyncHandler(async (req, res) => {
    const parsed = photoSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(400).json({ detail: 'No chauffeur profile' })

    const updated = await prisma.chauffeur.update({
      where: { id: chauffeur.id },
      data: { photo: parsed.data.photo },
      include: { vehicle: true },
    })
    return res.json(toChauffeur(updated))
  }),
)

// ---------- POST /verify/:pk/ (admin) ----------

router.post(
  '/verify/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const chauffeur = await prisma.chauffeur.findUnique({ where: { id: pk } })
    if (!chauffeur) return res.status(404).json({ detail: 'Not found' })
    await prisma.chauffeur.update({ where: { id: pk }, data: { isVerified: true } })
    return res.json({ detail: 'Chauffeur verified.' })
  }),
)

// ---------- POST /reject/:pk/ (admin) ----------
// Rejects a pending chauffeur application: deletes the chauffeur profile and
// reverts the user back to CLIENT so they can re-apply later.

router.post(
  '/reject/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const chauffeur = await prisma.chauffeur.findUnique({ where: { id: pk } })
    if (!chauffeur) return res.status(404).json({ detail: 'Not found' })

    await prisma.chauffeur.delete({ where: { id: pk } })
    await prisma.user.update({ where: { id: chauffeur.userId }, data: { role: 'CLIENT' } })

    return res.json({ detail: 'Chauffeur rejected.' })
  }),
)

// ---------- GET /stats/ and /stats/report.pdf (chauffeur) ----------
// "Espace chauffeur" — earnings/distance dashboard for a chosen period, and a matching PDF export.

const statsQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

const MONTHS_FR_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

async function computeStats(chauffeurId: number, from: Date, to: Date) {
  const trips = await prisma.trip.findMany({
    where: { driverId: chauffeurId, status: 'COMPLETED', endedAt: { gte: from, lte: to } },
    orderBy: { endedAt: 'asc' },
    select: { price: true, distanceKm: true, endedAt: true },
  })

  const totalTrips = trips.length
  const totalDistanceKm = trips.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0)
  const totalEarnings = trips.reduce((sum, t) => sum + (t.price ?? 0), 0)
  const averagePrice = totalTrips > 0 ? Math.round(totalEarnings / totalTrips) : 0

  // Bucket granularity auto-scales with the span so the breakdown stays readable
  // whether it's a single day or a full year. The grouping/sort key stays ISO-based
  // (lexicographically sortable); the display label is derived separately so it never
  // repeats information the period selection already made obvious (e.g. no need to
  // spell out today's date next to every hour when the "Jour" preset is selected).
  const spanDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  const bucketKey = (d: Date): string => {
    const iso = d.toISOString()
    if (spanDays <= 2) return iso.slice(0, 13) // hour bucket
    if (spanDays <= 45) return iso.slice(0, 10) // day
    if (spanDays <= 400) return iso.slice(0, 7) // month
    return iso.slice(0, 4) // year
  }
  const bucketDisplayLabel = (d: Date): string => {
    if (spanDays <= 2) return `${String(d.getUTCHours()).padStart(2, '0')}h`
    if (spanDays <= 45) return `${d.getUTCDate()} ${MONTHS_FR_SHORT[d.getUTCMonth()]}`
    if (spanDays <= 400) return `${MONTHS_FR_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    return String(d.getUTCFullYear())
  }

  const buckets = new Map<string, { trips: number; distance_km: number; earnings: number; sample: Date }>()
  for (const t of trips) {
    const d = t.endedAt as Date
    const key = bucketKey(d)
    const b = buckets.get(key) ?? { trips: 0, distance_km: 0, earnings: 0, sample: d }
    b.trips += 1
    b.distance_km += t.distanceKm ?? 0
    b.earnings += t.price ?? 0
    buckets.set(key, b)
  }
  const breakdown = Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => ({
      label: bucketDisplayLabel(v.sample),
      trips: v.trips,
      distance_km: Math.round(v.distance_km * 10) / 10,
      earnings: v.earnings,
    }))

  return {
    total_trips: totalTrips,
    total_distance_km: Math.round(totalDistanceKm * 10) / 10,
    total_earnings: totalEarnings,
    average_price: averagePrice,
    breakdown,
  }
}

function parseStatsRange(query: any): { from: Date; to: Date } | null {
  const parsed = statsQuerySchema.safeParse(query)
  if (!parsed.success) return null
  const from = new Date(parsed.data.from)
  const to = new Date(parsed.data.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  return { from, to }
}

router.get(
  '/stats/',
  authenticate,
  requireChauffeur,
  asyncHandler(async (req, res) => {
    const range = parseStatsRange(req.query)
    if (!range) return res.status(400).json({ detail: 'Invalid or missing from/to date' })

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(400).json({ detail: 'No chauffeur profile' })

    const stats = await computeStats(chauffeur.id, range.from, range.to)
    return res.json({ from: range.from.toISOString(), to: range.to.toISOString(), ...stats })
  }),
)

router.get(
  '/stats/report.pdf',
  authenticate,
  requireChauffeur,
  asyncHandler(async (req, res) => {
    const range = parseStatsRange(req.query)
    if (!range) return res.status(400).json({ detail: 'Invalid or missing from/to date' })
    const { from, to } = range

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id }, include: { user: true, vehicle: true } })
    if (!chauffeur) return res.status(400).json({ detail: 'No chauffeur profile' })

    const stats = await computeStats(chauffeur.id, from, to)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR')
    // Manual thousands separator with a plain space (U+0020) — Intl's 'fr-FR' grouping uses a
    // narrow no-break space (U+202F) that pdfkit's default Helvetica/WinAnsi can't render,
    // same class of bug as the "→" glyph below.
    const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

    const filename = `bilan-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // samaChauffeur brand palette (mirrors frontend/tailwind.config.cjs).
    const C = {
      brand700: '#b23409',
      brand600: '#d6440a',
      brand500: '#f2590e',
      brand100: '#ffe6d5',
      brand50: '#fff4ed',
      secondary700: '#126442',
      secondary600: '#157d51',
      secondary50: '#eefbf3',
      accent600: '#de9a1f',
      accent500: '#f6b93b',
      stone900: '#1c1917',
      stone700: '#44403c',
      stone500: '#78716c',
      stone200: '#e7e5e4',
      stone50: '#fafaf9',
      white: '#ffffff',
    }

    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 40, left: 50, right: 50 } })
    doc.pipe(res)

    const pageWidth = doc.page.width
    const contentRight = pageWidth - 50

    let pageNum = 1
    function addFooter() {
      const h = doc.page.height
      // pdfkit auto-inserts a page if a text call's y + line-height would cross
      // `page.height - margins.bottom` — so the footer text needs real headroom above
      // that boundary, not just above the bottom edge of the page.
      doc.moveTo(50, h - 70).lineTo(contentRight, h - 70).lineWidth(1).strokeColor(C.stone200).stroke()
      doc.font('Helvetica').fontSize(8).fillColor(C.stone500)
      doc.text('samaChauffeur — Bilan généré automatiquement', 50, h - 60, { width: 300 })
      doc.text(`Page ${pageNum}`, contentRight - 100, h - 60, { width: 100, align: 'right' })
      pageNum += 1
    }

    // ---- Header band ----
    const headerHeight = 100
    const gradient = doc.linearGradient(0, 0, pageWidth, headerHeight)
    gradient.stop(0, C.brand700).stop(0.6, C.brand500).stop(1, C.accent500)
    doc.rect(0, 0, pageWidth, headerHeight).fill(gradient)
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(24).text('samaChauffeur', 50, 32)
    doc.fillColor(C.brand100).font('Helvetica').fontSize(12).text('Bilan financier chauffeur', 50, 63)

    let y = headerHeight + 24

    // ---- Info card (chauffeur identity + period) ----
    const infoHeight = chauffeur.vehicle ? 78 : 60
    doc.roundedRect(50, y, contentRight - 50, infoHeight, 8).fill(C.stone50)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.stone900).text('CHAUFFEUR', 66, y + 14)
    doc.font('Helvetica').fontSize(10).fillColor(C.stone700)
    doc.text(`${chauffeur.user.username} · ${chauffeur.user.phone}`, 66, y + 30)
    if (chauffeur.vehicle) doc.text(`Véhicule : ${chauffeur.vehicle.plateNumber}`, 66, y + 46)

    const rightColX = pageWidth - 270
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.stone900).text('PÉRIODE', rightColX, y + 14, { width: 220, align: 'right' })
    doc.font('Helvetica').fontSize(10).fillColor(C.stone700)
    // Plain hyphen, not "→" — same WinAnsi glyph limitation as above.
    doc.text(`${fmt(from)} - ${fmt(to)}`, rightColX, y + 30, { width: 220, align: 'right' })
    doc.text(`Généré le ${fmt(new Date())}`, rightColX, y + 46, { width: 220, align: 'right' })

    y += infoHeight + 24

    // ---- KPI cards ----
    const kpis = [
      { label: 'COURSES TERMINÉES', value: fmtNum(stats.total_trips), color: C.stone900 },
      { label: 'DISTANCE PARCOURUE', value: `${fmtNum(stats.total_distance_km)} km`, color: C.brand600 },
      { label: 'MONTANT GAGNÉ', value: `${fmtNum(stats.total_earnings)} XOF`, color: C.secondary600 },
      { label: 'PRIX MOYEN / COURSE', value: `${fmtNum(stats.average_price)} XOF`, color: C.accent600 },
    ]
    const kpiGap = 12
    const kpiWidth = (contentRight - 50 - kpiGap * 3) / 4
    const kpiHeight = 62
    kpis.forEach((k, i) => {
      const x = 50 + i * (kpiWidth + kpiGap)
      doc.roundedRect(x, y, kpiWidth, kpiHeight, 8).lineWidth(1).fillAndStroke(C.white, C.stone200)
      doc.roundedRect(x, y, 4, kpiHeight, 2).fill(k.color)
      doc.font('Helvetica').fontSize(7.5).fillColor(C.stone500).text(k.label, x + 12, y + 12, { width: kpiWidth - 20 })
      doc.font('Helvetica-Bold').fontSize(13).fillColor(k.color).text(k.value, x + 12, y + 30, { width: kpiWidth - 18 })
    })
    y += kpiHeight + 30

    // ---- Breakdown table ----
    doc.roundedRect(50, y, 4, 15, 2).fill(C.brand500)
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.stone900).text('Détail par période', 62, y - 1)
    y += 28

    const colX = [50, 250, 370, 460]
    const colW = [190, 110, 90, 80]
    const rowH = 22
    const pageBottom = doc.page.height - 80

    function tableHeader(yy: number) {
      doc.roundedRect(50, yy, contentRight - 50, rowH, 4).fill(C.brand500)
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
      doc.text('PÉRIODE', colX[0] + 10, yy + 7, { width: colW[0] - 10 })
      doc.text('COURSES', colX[1], yy + 7, { width: colW[1], align: 'right' })
      doc.text('DISTANCE (KM)', colX[2], yy + 7, { width: colW[2], align: 'right' })
      doc.text('GAINS (XOF)', colX[3], yy + 7, { width: colW[3] - 10, align: 'right' })
    }

    tableHeader(y)
    y += rowH

    if (stats.breakdown.length === 0) {
      doc.font('Helvetica').fontSize(9.5).fillColor(C.stone500)
      doc.text('Aucune course terminée sur cette période.', colX[0] + 10, y + 6)
      y += rowH
    }

    stats.breakdown.forEach((b, i) => {
      if (y > pageBottom) {
        addFooter()
        doc.addPage()
        y = 50
        tableHeader(y)
        y += rowH
      }
      if (i % 2 === 1) doc.rect(50, y, contentRight - 50, rowH).fill(C.stone50)
      doc.font('Helvetica').fontSize(9.5).fillColor(C.stone700)
      doc.text(b.label, colX[0] + 10, y + 6, { width: colW[0] - 10 })
      doc.text(fmtNum(b.trips), colX[1], y + 6, { width: colW[1], align: 'right' })
      doc.text(fmtNum(b.distance_km), colX[2], y + 6, { width: colW[2], align: 'right' })
      doc.text(fmtNum(b.earnings), colX[3], y + 6, { width: colW[3] - 10, align: 'right' })
      y += rowH
    })

    if (y > pageBottom) {
      addFooter()
      doc.addPage()
      y = 50
    }
    doc.roundedRect(50, y, contentRight - 50, rowH + 6, 4).fill(C.secondary50)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.secondary700)
    doc.text('TOTAL', colX[0] + 10, y + 9, { width: colW[0] - 10 })
    doc.text(fmtNum(stats.total_trips), colX[1], y + 9, { width: colW[1], align: 'right' })
    doc.text(fmtNum(stats.total_distance_km), colX[2], y + 9, { width: colW[2], align: 'right' })
    doc.text(fmtNum(stats.total_earnings), colX[3], y + 9, { width: colW[3] - 10, align: 'right' })

    addFooter()
    doc.end()
  }),
)

// ---------- GET /:id/location-history/?limit= (admin) ----------
// NB: registered last so it can't shadow any of the more specific literal routes above
// (Express matches route registration order, but this two-segment path only conflicts with
// other two-segment "/:id/xxx" routes, of which there are none here).

router.get(
  '/:id/location-history/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid chauffeur id' })

    const limitRaw = parseInt(String(req.query.limit ?? '100'), 10)
    const limit = Number.isNaN(limitRaw) ? 100 : Math.min(Math.max(limitRaw, 1), 500)

    const pings = await prisma.chauffeurLocationPing.findMany({
      where: { chauffeurId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return res.json(pings.map(toLocationPing))
  }),
)

export default router
