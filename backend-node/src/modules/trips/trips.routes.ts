import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin } from '../../middleware/auth'
import { haversine } from '../../utils/haversine'
import { estimatePrice, NoPricingRuleError, resolvePromoCode, InvalidPromoCodeError } from '../pricing/pricing.service'
import { broadcastToDrivers, broadcastToTrip } from '../../realtime/socket'
import { getOrCreateProfile, recordDistance, getRewardsStatus } from '../clients/rewards.service'

const router = Router()

const VEHICLE_TYPES = ['CAR', 'SEDAN', 'SUV', 'MINIBUS', 'BUS'] as const
const PAYMENT_METHODS = ['CASH', 'ORANGE'] as const

// A chauffeur may only claim a trip whose pickup point (origin) is within this radius of
// their last known position — keeps drivers from taking rides they'd have to cross town for.
const MAX_CLAIM_RADIUS_KM = 5

export function toTrip(t: any) {
  return {
    id: t.id,
    passenger: t.passengerId,
    driver: t.driverId,
    driver_detail: t.driver
      ? {
          id: t.driver.id,
          username: t.driver.user?.username,
          phone: t.driver.user?.phone,
          photo: t.driver.photo,
          vehicle: t.driver.vehicle
            ? { type: t.driver.vehicle.type, plate_number: t.driver.vehicle.plateNumber, seats: t.driver.vehicle.seats }
            : null,
        }
      : null,
    origin: t.origin,
    origin_lat: t.originLat,
    origin_lng: t.originLng,
    destination: t.destination,
    dest_lat: t.destLat,
    dest_lng: t.destLng,
    stops: t.stops ?? [],
    scheduled_at: t.scheduledAt,
    deposit_amount: t.depositAmount,
    promo_code: t.promoCode,
    discount_amount: t.discountAmount,
    distance_km: t.distanceKm,
    estimated_duration: t.estimatedDuration,
    mode: t.mode,
    vehicle_type: t.vehicleType,
    payment_method: t.paymentMethod,
    price: t.price,
    status: t.status,
    created_at: t.createdAt,
    started_at: t.startedAt,
    ended_at: t.endedAt,
    rating: t.rating
      ? {
          id: t.rating.id,
          rating: t.rating.rating,
          comment: t.rating.comment,
          skipped: t.rating.skipped,
          created_at: t.rating.createdAt,
        }
      : null,
  }
}

// ---------- POST /create/ ----------

const stopSchema = z.object({
  label: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const createTripSchema = z
  .object({
    origin: z.string().min(1),
    origin_lat: z.number().optional(),
    origin_lng: z.number().optional(),
    destination: z.string().min(1),
    dest_lat: z.number().optional(),
    dest_lng: z.number().optional(),
    stops: z.array(stopSchema).max(3).optional(),
    mode: z.enum(['PRIVATE', 'SHARED', 'BUS']).optional().default('PRIVATE'),
    vehicle_type: z.enum(VEHICLE_TYPES).optional().default('CAR'),
    payment_method: z.enum(PAYMENT_METHODS).optional().default('CASH'),
    distance_km: z.number().positive().optional(),
    scheduled_at: z.string().datetime().optional(),
    promo_code: z.string().optional(),
  })
  .refine((v) => (v.origin_lat == null) === (v.origin_lng == null), {
    message: 'Both origin_lat and origin_lng must be provided together',
  })
  .refine((v) => (v.dest_lat == null) === (v.dest_lng == null), {
    message: 'Both dest_lat and dest_lng must be provided together',
  })

// Courses programmées: the deposit obliges the passenger to actually show up — simulated
// (no real payment gateway), captured as a COMPLETED transaction right away since there's
// no driver yet at booking time to validate it against.
const DEPOSIT_RATE = 0.2
const MIN_DEPOSIT_XOF = 200

router.post(
  '/create/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = createTripSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data

    let scheduledAt: Date | null = null
    if (data.scheduled_at) {
      scheduledAt = new Date(data.scheduled_at)
      if (scheduledAt.getTime() <= Date.now()) {
        return res.status(400).json({ detail: 'scheduled_at must be in the future' })
      }
    }

    let distanceKm: number | null = null
    let price: number | null = null
    if (data.origin_lat != null && data.origin_lng != null && data.dest_lat != null && data.dest_lng != null) {
      // Trust the frontend's real road-route distance (OSRM) when provided — it's what the
      // passenger's price estimate was computed from, so the created trip must match it
      // instead of silently recomputing a shorter straight-line distance.
      distanceKm = data.distance_km ?? haversine(data.origin_lat, data.origin_lng, data.dest_lat, data.dest_lng)
      try {
        const est = await estimatePrice(distanceKm, data.vehicle_type, data.mode)
        price = Math.round(est.price)
      } catch (e) {
        if (!(e instanceof NoPricingRuleError)) throw e
        // no pricing rule found for this vehicle_type/mode — leave price null, same as the Django view
      }
    }

    if (scheduledAt && price == null) {
      return res.status(400).json({ detail: 'A price estimate (origin/destination coordinates) is required to schedule a trip and collect its deposit' })
    }

    let discountAmount: number | null = null
    let appliedPromo: Awaited<ReturnType<typeof resolvePromoCode>> | null = null
    // Two entirely independent auto-applied discounts — a distance-progression gift
    // (rewards.service.ts) has nothing to do with a saved promo code (clients.routes.ts POST
    // /promo-code/); at most one is consumed per trip, gift taking priority since it's tied to
    // a specific reward moment rather than a code the client can reuse whenever they like.
    let consumedDiscount: { pct: number; source: 'GIFT' | 'PROMO'; promoCode: string | null; promoId: number | null } | null = null

    const profile = await getOrCreateProfile(req.user!.id)
    if (profile.pendingGiftDiscountPct != null && price != null) {
      discountAmount = Math.round(price * (profile.pendingGiftDiscountPct / 100))
      price = price - discountAmount
      consumedDiscount = { pct: profile.pendingGiftDiscountPct, source: 'GIFT', promoCode: null, promoId: null }
    } else if (profile.pendingPromoDiscountPct != null && price != null) {
      discountAmount = Math.round(price * (profile.pendingPromoDiscountPct / 100))
      price = price - discountAmount
      consumedDiscount = { pct: profile.pendingPromoDiscountPct, source: 'PROMO', promoCode: profile.pendingPromoCode, promoId: profile.pendingPromoId }
    } else if (data.promo_code) {
      // Legacy path kept for backward compatibility — a code passed directly in the
      // request instead of pre-saved on the profile.
      if (price == null) return res.status(400).json({ detail: 'A price estimate is required to apply a promo code' })
      try {
        appliedPromo = await resolvePromoCode(data.promo_code, req.user!.id)
      } catch (e) {
        if (e instanceof InvalidPromoCodeError) return res.status(400).json({ detail: e.message })
        throw e
      }
      discountAmount = Math.round(price * (appliedPromo.discountPct / 100))
      price = price - discountAmount
    }

    const depositAmount = scheduledAt ? Math.max(MIN_DEPOSIT_XOF, Math.round(price! * DEPOSIT_RATE)) : null

    const trip = await prisma.trip.create({
      data: {
        passengerId: req.user!.id,
        origin: data.origin,
        originLat: data.origin_lat,
        originLng: data.origin_lng,
        destination: data.destination,
        destLat: data.dest_lat,
        destLng: data.dest_lng,
        stops: data.stops ?? undefined,
        mode: data.mode,
        vehicleType: data.vehicle_type,
        paymentMethod: data.payment_method,
        distanceKm: distanceKm ?? undefined,
        price: price ?? undefined,
        status: scheduledAt ? 'SCHEDULED' : undefined,
        scheduledAt: scheduledAt ?? undefined,
        depositAmount: depositAmount ?? undefined,
        promoCode: consumedDiscount
          ? consumedDiscount.promoCode ?? 'GIFT_REWARD'
          : appliedPromo
            ? data.promo_code!.trim().toUpperCase()
            : undefined,
        discountAmount: discountAmount ?? undefined,
      },
    })

    if (consumedDiscount?.source === 'GIFT') {
      await prisma.clientProfile.update({ where: { userId: req.user!.id }, data: { pendingGiftDiscountPct: null } })
    } else if (consumedDiscount?.source === 'PROMO') {
      await prisma.clientProfile.update({
        where: { userId: req.user!.id },
        data: { pendingPromoCode: null, pendingPromoDiscountPct: null, pendingPromoId: null },
      })
      if (consumedDiscount.promoId) {
        await prisma.promoCode.update({ where: { id: consumedDiscount.promoId }, data: { usedCount: { increment: 1 } } })
      }
    } else if (appliedPromo?.kind === 'PROMO' && appliedPromo.promo) {
      await prisma.promoCode.update({ where: { id: appliedPromo.promo.id }, data: { usedCount: { increment: 1 } } })
    }

    if (scheduledAt) {
      // Simulated deposit — no real payment gateway, captured as COMPLETED immediately since
      // there's no driver yet at booking time to validate it against (see validate/ below).
      await prisma.transaction.create({
        data: {
          clientId: profile.id,
          amount: depositAmount!,
          currency: 'XOF',
          method: data.payment_method,
          status: 'COMPLETED',
          metadata: { trip_id: trip.id, kind: 'deposit' },
        },
      })
    } else {
      // Broadcast to drivers that a new trip is available to claim. This must carry the same
      // shape as the REST /available/ list (toTrip()) — drivers append it straight into their
      // trips list, and a payload missing `id` (previously this only sent `trip_id`) meant
      // clicking "Prendre" on a live-arrived request sent claim/undefined/ and crashed claiming.
      broadcastToDrivers({
        ...toTrip(trip),
        type: 'trip.requested',
        trip_id: trip.id,
      })
    }

    return res.status(201).json(toTrip(trip))
  }),
)

// ---------- GET /rewards/ (cadeaux basés sur les km parcourus) ----------

router.get(
  '/rewards/',
  authenticate,
  asyncHandler(async (req, res) => {
    const status = await getRewardsStatus(req.user!.id)
    return res.json(status)
  }),
)

// ---------- GET /my/ ----------

router.get(
  '/my/',
  authenticate,
  asyncHandler(async (req, res) => {
    const trips = await prisma.trip.findMany({
      where: { passengerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true, vehicle: true } }, rating: true },
    })
    return res.json(trips.map(toTrip))
  }),
)

// ---------- GET /admin/all/ (admin) ----------
// Full trip list for the admin overview dashboard — includes both the passenger and driver
// identities so the table doesn't need a second round-trip per row.

function toTripAdmin(t: any) {
  return {
    ...toTrip(t),
    passenger_detail: t.passenger ? { id: t.passenger.id, username: t.passenger.username, phone: t.passenger.phone } : null,
  }
}

router.get(
  '/admin/all/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limitRaw = parseInt(String(req.query.limit ?? '200'), 10)
    const limit = Number.isNaN(limitRaw) ? 200 : Math.min(Math.max(limitRaw, 1), 1000)
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { driver: { include: { user: true, vehicle: true } }, passenger: true, rating: true },
    })
    return res.json(trips.map(toTripAdmin))
  }),
)

// ---------- GET /available/ (chauffeurs only) ----------

router.get(
  '/available/',
  authenticate,
  asyncHandler(async (req, res) => {
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(403).json({ detail: 'Not a chauffeur' })
    const trips = await prisma.trip.findMany({ where: { status: 'REQUESTED' } })
    return res.json(trips.map(toTrip))
  }),
)

// ---------- GET /my-active/ (chauffeur) ----------
// The trip currently assigned to this driver and not yet over — lets the driver dashboard
// restore its in-progress trip panel (route + accept/start/end actions) after a page reload.

router.get(
  '/my-active/',
  authenticate,
  asyncHandler(async (req, res) => {
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(403).json({ detail: 'Not a chauffeur' })

    const trip = await prisma.trip.findFirst({
      where: { driverId: chauffeur.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'] } },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true, vehicle: true } }, rating: true },
    })
    if (!trip) return res.json(null)
    return res.json(toTrip(trip))
  }),
)

// ---------- POST /claim/:pk/ ----------

router.post(
  '/claim/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(403).json({ detail: 'Not a chauffeur' })

    const pk = parseInt(req.params.pk, 10)
    if (Number.isNaN(pk)) return res.status(400).json({ detail: 'Invalid trip id' })
    const trip = await prisma.trip.findUnique({ where: { id: pk } })
    if (!trip) return res.status(404).json({ detail: 'Not found' })
    if (trip.status !== 'REQUESTED' || trip.driverId !== null) {
      return res.status(400).json({ detail: 'Trip not claimable' })
    }

    // Only enforced when both positions are known — a driver whose location hasn't reported
    // yet shouldn't be blocked from claiming just because of that.
    if (chauffeur.latitude != null && chauffeur.longitude != null && trip.originLat != null && trip.originLng != null) {
      const distanceKm = haversine(chauffeur.latitude, chauffeur.longitude, trip.originLat, trip.originLng)
      if (distanceKm > MAX_CLAIM_RADIUS_KM) {
        return res.status(400).json({ detail: `Cette course est hors de votre secteur (à ${distanceKm.toFixed(1)} km, max ${MAX_CLAIM_RADIUS_KM} km).` })
      }
    }

    const updated = await prisma.trip.update({ where: { id: pk }, data: { driverId: chauffeur.id, status: 'ASSIGNED' } })
    await prisma.chauffeur.update({ where: { id: chauffeur.id }, data: { isAvailable: false } })

    broadcastToDrivers({ type: 'trip.assigned', trip_id: trip.id, driver_id: chauffeur.id })
    broadcastToTrip(trip.id, { type: 'trip.update', status: 'ASSIGNED', trip_id: trip.id })

    return res.json({ detail: 'Claimed', trip: toTrip(updated) })
  }),
)

// ---------- GET /:pk/ ----------

router.get(
  '/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    if (Number.isNaN(pk)) return res.status(400).json({ detail: 'Invalid trip id' })
    const trip = await prisma.trip.findUnique({ where: { id: pk }, include: { driver: { include: { user: true, vehicle: true } }, rating: true } })
    if (!trip) return res.status(404).json({ detail: 'Not found' })
    return res.json(toTrip(trip))
  }),
)

async function requireOwnTripAsPassenger(req: any, res: any, pk: number) {
  if (Number.isNaN(pk)) {
    res.status(400).json({ detail: 'Invalid trip id' })
    return null
  }
  const trip = await prisma.trip.findUnique({ where: { id: pk } })
  if (!trip) {
    res.status(404).json({ detail: 'Not found' })
    return null
  }
  if (trip.passengerId !== req.user!.id) {
    res.status(403).json({ detail: 'Not your trip' })
    return null
  }
  return trip
}

async function requireOwnTrip(req: any, res: any, pk: number) {
  if (Number.isNaN(pk)) {
    res.status(400).json({ detail: 'Invalid trip id' })
    return null
  }
  const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
  if (!chauffeur) {
    res.status(400).json({ detail: 'Not a chauffeur' })
    return null
  }
  const trip = await prisma.trip.findUnique({ where: { id: pk } })
  if (!trip) {
    res.status(404).json({ detail: 'Not found' })
    return null
  }
  if (trip.driverId !== chauffeur.id) {
    res.status(403).json({ detail: 'Not assigned to you' })
    return null
  }
  return { chauffeur, trip }
}

// ---------- POST /:pk/accept/ ----------

router.post(
  '/:pk/accept/',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = await requireOwnTrip(req, res, parseInt(req.params.pk, 10))
    if (!ctx) return
    if (!['ASSIGNED', 'REQUESTED'].includes(ctx.trip.status)) {
      return res.status(400).json({ detail: 'Cannot accept in current state' })
    }
    await prisma.trip.update({ where: { id: ctx.trip.id }, data: { status: 'ACCEPTED' } })
    broadcastToTrip(ctx.trip.id, { type: 'trip.update', status: 'ACCEPTED', trip_id: ctx.trip.id })
    return res.json({ detail: 'Trip accepted' })
  }),
)

// ---------- POST /:pk/arrived/ ----------
// Driver signals they've reached the pickup point — lets the passenger's screen switch from
// "chauffeur en route" to "chauffeur arrivé" instead of guessing from the ETA alone.

router.post(
  '/:pk/arrived/',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = await requireOwnTrip(req, res, parseInt(req.params.pk, 10))
    if (!ctx) return
    if (!['ACCEPTED', 'ASSIGNED'].includes(ctx.trip.status)) {
      return res.status(400).json({ detail: 'Cannot mark arrived in current state' })
    }
    await prisma.trip.update({ where: { id: ctx.trip.id }, data: { status: 'ARRIVED' } })
    broadcastToTrip(ctx.trip.id, { type: 'trip.update', status: 'ARRIVED', trip_id: ctx.trip.id })
    return res.json({ detail: 'Trip marked as arrived' })
  }),
)

// ---------- POST /:pk/reject/ ----------

router.post(
  '/:pk/reject/',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = await requireOwnTrip(req, res, parseInt(req.params.pk, 10))
    if (!ctx) return
    const { chauffeur, trip } = ctx

    await prisma.trip.update({ where: { id: trip.id }, data: { driverId: null, status: 'REQUESTED' } })
    await prisma.chauffeur.update({ where: { id: chauffeur.id }, data: { isAvailable: true } })

    // try to reassign to the nearest other available, verified chauffeur (excluding this one)
    if (trip.originLat != null && trip.originLng != null) {
      const candidates = await prisma.chauffeur.findMany({
        where: { isVerified: true, isAvailable: true, latitude: { not: null }, longitude: { not: null }, id: { not: chauffeur.id } },
      })
      let best: (typeof candidates)[number] | null = null
      let bestDist = Infinity
      for (const c of candidates) {
        const dist = haversine(trip.originLat, trip.originLng, c.latitude!, c.longitude!)
        if (dist < bestDist) {
          best = c
          bestDist = dist
        }
      }
      if (best) {
        await prisma.trip.update({ where: { id: trip.id }, data: { driverId: best.id, status: 'ASSIGNED' } })
        await prisma.chauffeur.update({ where: { id: best.id }, data: { isAvailable: false } })
        broadcastToTrip(trip.id, { type: 'trip.update', status: 'ASSIGNED', trip_id: trip.id })
        return res.json({ detail: 'Trip reassigned', new_driver: best.id })
      }
    }

    broadcastToTrip(trip.id, { type: 'trip.update', status: 'REQUESTED', trip_id: trip.id })
    return res.json({ detail: 'Trip unassigned and queued' })
  }),
)

// ---------- POST /:pk/start/ ----------

router.post(
  '/:pk/start/',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = await requireOwnTrip(req, res, parseInt(req.params.pk, 10))
    if (!ctx) return
    if (!['ACCEPTED', 'ASSIGNED', 'ARRIVED'].includes(ctx.trip.status)) {
      return res.status(400).json({ detail: 'Cannot start in current state' })
    }
    await prisma.trip.update({ where: { id: ctx.trip.id }, data: { status: 'STARTED', startedAt: new Date() } })
    broadcastToTrip(ctx.trip.id, { type: 'trip.update', status: 'STARTED', trip_id: ctx.trip.id })
    return res.json({ detail: 'Trip started' })
  }),
)

// ---------- POST /:pk/end/ ----------

router.post(
  '/:pk/end/',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = await requireOwnTrip(req, res, parseInt(req.params.pk, 10))
    if (!ctx) return
    if (ctx.trip.status !== 'STARTED') {
      return res.status(400).json({ detail: 'Cannot end trip not started' })
    }
    await prisma.trip.update({ where: { id: ctx.trip.id }, data: { status: 'COMPLETED', endedAt: new Date() } })
    await prisma.chauffeur.update({ where: { id: ctx.chauffeur.id }, data: { isAvailable: true } })

    // Feeds the passenger's distance-progression gifts (rewards.service.ts) — included inline
    // in the broadcast so the passenger's checkpoint-celebration UI doesn't need a second call.
    let checkpoints: { km: number; discount_pct: number | null }[] = []
    if (ctx.trip.distanceKm != null) {
      checkpoints = await recordDistance(ctx.trip.passengerId, ctx.trip.distanceKm)
    }

    broadcastToTrip(ctx.trip.id, { type: 'trip.update', status: 'COMPLETED', trip_id: ctx.trip.id, checkpoints })
    return res.json({ detail: 'Trip completed' })
  }),
)

// ---------- POST /:pk/cancel/ (passenger) ----------

router.post(
  '/:pk/cancel/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    if (!['SCHEDULED', 'REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED'].includes(trip.status)) {
      return res.status(400).json({ detail: 'Cannot cancel in current state' })
    }

    if (trip.driverId != null) {
      await prisma.chauffeur.update({ where: { id: trip.driverId }, data: { isAvailable: true } })
    }
    await prisma.trip.update({ where: { id: pk }, data: { status: 'CANCELLED' } })
    broadcastToTrip(pk, { type: 'trip.update', status: 'CANCELLED', trip_id: pk })

    return res.json({ detail: 'Trip cancelled' })
  }),
)

// ---------- POST /:pk/vehicle-type/ (passenger) ----------

const vehicleTypeSchema = z.object({ vehicle_type: z.enum(VEHICLE_TYPES) })

router.post(
  '/:pk/vehicle-type/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    if (trip.status !== 'REQUESTED') {
      return res.status(400).json({ detail: 'Cannot change vehicle type once a driver is assigned' })
    }

    const parsed = vehicleTypeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    let price = trip.price
    if (trip.distanceKm != null) {
      try {
        const est = await estimatePrice(trip.distanceKm, parsed.data.vehicle_type, trip.mode)
        price = Math.round(est.price)
      } catch (e) {
        if (!(e instanceof NoPricingRuleError)) throw e
        price = null
      }
    }

    const updated = await prisma.trip.update({
      where: { id: pk },
      data: { vehicleType: parsed.data.vehicle_type, price: price ?? undefined },
      include: { driver: { include: { user: true, vehicle: true } }, rating: true },
    })
    broadcastToTrip(pk, { type: 'trip.update', status: updated.status, trip_id: pk })

    return res.json(toTrip(updated))
  }),
)

// ---------- POST /:pk/payment-method/ (passenger) ----------

const paymentMethodSchema = z.object({ payment_method: z.enum(PAYMENT_METHODS) })

router.post(
  '/:pk/payment-method/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    // Unlike the vehicle type, the payment method doesn't affect driver matching, so it
    // stays editable for the whole lifecycle of the trip — only locked once it's over.
    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) {
      return res.status(400).json({ detail: 'Cannot change payment method once the trip is over' })
    }

    const parsed = paymentMethodSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    const updated = await prisma.trip.update({
      where: { id: pk },
      data: { paymentMethod: parsed.data.payment_method },
      include: { driver: { include: { user: true, vehicle: true } }, rating: true },
    })
    broadcastToTrip(pk, { type: 'trip.update', status: updated.status, trip_id: pk })

    return res.json(toTrip(updated))
  }),
)

// ---------- POST /:pk/rate/ (passenger) ----------

const rateTripSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

router.post(
  '/:pk/rate/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ detail: 'Can only rate after trip is completed' })
    }

    const existing = await prisma.tripRating.findUnique({ where: { tripId: pk } })
    if (existing) {
      return res.status(400).json({ detail: 'This trip has already been rated' })
    }

    const parsed = rateTripSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    if (!trip.driverId) {
      return res.status(400).json({ detail: 'No driver assigned to this trip' })
    }

    const rating = await prisma.tripRating.create({
      data: {
        tripId: pk,
        passengerId: req.user!.id,
        driverId: trip.driverId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      },
    })

    broadcastToTrip(pk, { type: 'trip.rated', trip_id: pk, rating: rating.rating })

    return res.status(201).json({
      id: rating.id,
      trip: rating.tripId,
      rating: rating.rating,
      comment: rating.comment,
      skipped: rating.skipped,
      created_at: rating.createdAt,
    })
  }),
)

// ---------- POST /:pk/skip-rating/ (passenger) ----------

router.post(
  '/:pk/skip-rating/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ detail: 'Can only skip rating after trip is completed' })
    }

    const existing = await prisma.tripRating.findUnique({ where: { tripId: pk } })
    if (existing) {
      return res.status(400).json({ detail: 'This trip has already been rated or skipped' })
    }

    if (!trip.driverId) {
      return res.status(400).json({ detail: 'No driver assigned to this trip' })
    }

    const rating = await prisma.tripRating.create({
      data: {
        tripId: pk,
        passengerId: req.user!.id,
        driverId: trip.driverId,
        rating: 0,
        skipped: true,
      },
    })

    return res.status(201).json({
      id: rating.id,
      trip: rating.tripId,
      rating: rating.rating,
      skipped: rating.skipped,
      created_at: rating.createdAt,
    })
  }),
)

// ---------- POST /:pk/share/ (passenger) ----------
// Live trip sharing: returns an unguessable token a friend/family member can use to follow
// the ride, without an account, via GET /shared/:token/ below. Idempotent — reuses the
// existing token if one was already generated for this trip.

router.post(
  '/:pk/share/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    const shareToken = trip.shareToken ?? randomUUID()
    if (!trip.shareToken) {
      await prisma.trip.update({ where: { id: pk }, data: { shareToken } })
    }
    return res.json({ share_token: shareToken })
  }),
)

// ---------- GET /shared/:token/ (public — no auth) ----------
// Deliberately minimal: no passenger identity, no driver phone — just enough for a follower
// to see where the ride is and that it's progressing normally.

router.get(
  '/shared/:token/',
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { shareToken: req.params.token },
      include: { driver: { include: { user: true, vehicle: true } } },
    })
    if (!trip) return res.status(404).json({ detail: 'Not found' })

    const ONGOING = ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED']
    return res.json({
      status: trip.status,
      origin: trip.origin,
      origin_lat: trip.originLat,
      origin_lng: trip.originLng,
      destination: trip.destination,
      dest_lat: trip.destLat,
      dest_lng: trip.destLng,
      distance_km: trip.distanceKm,
      created_at: trip.createdAt,
      driver: trip.driver
        ? {
            username: trip.driver.user?.username,
            photo: trip.driver.photo,
            vehicle: trip.driver.vehicle
              ? { type: trip.driver.vehicle.type, plate_number: trip.driver.vehicle.plateNumber }
              : null,
            latitude: ONGOING.includes(trip.status) ? trip.driver.latitude : null,
            longitude: ONGOING.includes(trip.status) ? trip.driver.longitude : null,
          }
        : null,
    })
  }),
)

// ---------- POST /:pk/sos/ (passenger) ----------
// Discreet in-ride SOS: persists an alert for admin review and lets the client immediately
// follow up with a real emergency call — no gating on trip status, an alert is always accepted.

const sosSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
})

router.post(
  '/:pk/sos/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const trip = await requireOwnTripAsPassenger(req, res, pk)
    if (!trip) return

    const parsed = sosSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    const alert = await prisma.sosAlert.create({
      data: {
        tripId: pk,
        passengerId: req.user!.id,
        latitude: parsed.data.lat,
        longitude: parsed.data.lng,
      },
    })
    return res.status(201).json({ id: alert.id, created_at: alert.createdAt })
  }),
)

// ---------- GET /admin/sos/ (admin) ----------

router.get(
  '/admin/sos/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const alerts = await prisma.sosAlert.findMany({
      orderBy: { createdAt: 'desc' },
      include: { trip: true, passenger: true },
    })
    return res.json(
      alerts.map((a) => ({
        id: a.id,
        trip_id: a.tripId,
        trip_origin: a.trip.origin,
        trip_destination: a.trip.destination,
        passenger_username: a.passenger.username,
        passenger_phone: a.passenger.phone,
        latitude: a.latitude,
        longitude: a.longitude,
        resolved: a.resolved,
        created_at: a.createdAt,
      })),
    )
  }),
)

// ---------- POST /admin/sos/:pk/resolve/ (admin) ----------

router.post(
  '/admin/sos/:pk/resolve/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    if (Number.isNaN(pk)) return res.status(400).json({ detail: 'Invalid id' })
    const alert = await prisma.sosAlert.findUnique({ where: { id: pk } })
    if (!alert) return res.status(404).json({ detail: 'Not found' })
    const updated = await prisma.sosAlert.update({ where: { id: pk }, data: { resolved: true } })
    return res.json({ id: updated.id, resolved: updated.resolved })
  }),
)

export default router
