import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin, requireClient } from '../../middleware/auth'

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
  }
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

    const chauffeur = await prisma.chauffeur.create({
      data: { userId, vehicleId, isVerified: false, isAvailable: false },
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
    const chauffeurs = await prisma.chauffeur.findMany({ include: { vehicle: true }, orderBy: { id: 'asc' } })
    return res.json(chauffeurs.map(toChauffeur))
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

export default router
