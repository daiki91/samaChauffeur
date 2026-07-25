import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate } from '../../middleware/auth'
import { haversine } from '../../utils/haversine'
import { estimatePrice, NoPricingRuleError } from '../pricing/pricing.service'
import { broadcastToDrivers, broadcastToTrip } from '../../realtime/socket'

const router = Router()

const VEHICLE_TYPES = ['CAR', 'SEDAN', 'SUV', 'MINIBUS', 'BUS'] as const
const PAYMENT_METHODS = ['CASH', 'ORANGE'] as const

function toTrip(t: any) {
  return {
    id: t.id,
    passenger: t.passengerId,
    driver: t.driverId,
    driver_detail: t.driver
      ? {
          id: t.driver.id,
          username: t.driver.user?.username,
          phone: t.driver.user?.phone,
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
  }
}

// ---------- POST /create/ ----------

const createTripSchema = z
  .object({
    origin: z.string().min(1),
    origin_lat: z.number().optional(),
    origin_lng: z.number().optional(),
    destination: z.string().min(1),
    dest_lat: z.number().optional(),
    dest_lng: z.number().optional(),
    mode: z.enum(['PRIVATE', 'SHARED', 'BUS']).optional().default('PRIVATE'),
    vehicle_type: z.enum(VEHICLE_TYPES).optional().default('CAR'),
    payment_method: z.enum(PAYMENT_METHODS).optional().default('CASH'),
    distance_km: z.number().positive().optional(),
  })
  .refine((v) => (v.origin_lat == null) === (v.origin_lng == null), {
    message: 'Both origin_lat and origin_lng must be provided together',
  })
  .refine((v) => (v.dest_lat == null) === (v.dest_lng == null), {
    message: 'Both dest_lat and dest_lng must be provided together',
  })

router.post(
  '/create/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = createTripSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data

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

    const trip = await prisma.trip.create({
      data: {
        passengerId: req.user!.id,
        origin: data.origin,
        originLat: data.origin_lat,
        originLng: data.origin_lng,
        destination: data.destination,
        destLat: data.dest_lat,
        destLng: data.dest_lng,
        mode: data.mode,
        vehicleType: data.vehicle_type,
        paymentMethod: data.payment_method,
        distanceKm: distanceKm ?? undefined,
        price: price ?? undefined,
      },
    })

    // broadcast to drivers that a new trip is available to claim
    broadcastToDrivers({
      type: 'trip.requested',
      trip_id: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      distance_km: trip.distanceKm,
      price: trip.price,
    })

    return res.status(201).json(toTrip(trip))
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
      include: { driver: { include: { user: true, vehicle: true } } },
    })
    return res.json(trips.map(toTrip))
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
      where: { driverId: chauffeur.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'STARTED'] } },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true, vehicle: true } } },
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
    const trip = await prisma.trip.findUnique({ where: { id: pk } })
    if (!trip) return res.status(404).json({ detail: 'Not found' })
    if (trip.status !== 'REQUESTED' || trip.driverId !== null) {
      return res.status(400).json({ detail: 'Trip not claimable' })
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
    const trip = await prisma.trip.findUnique({ where: { id: pk }, include: { driver: { include: { user: true, vehicle: true } } } })
    if (!trip) return res.status(404).json({ detail: 'Not found' })
    return res.json(toTrip(trip))
  }),
)

async function requireOwnTripAsPassenger(req: any, res: any, pk: number) {
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
    if (!['ACCEPTED', 'ASSIGNED'].includes(ctx.trip.status)) {
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
    broadcastToTrip(ctx.trip.id, { type: 'trip.update', status: 'COMPLETED', trip_id: ctx.trip.id })
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

    if (!['REQUESTED', 'ASSIGNED', 'ACCEPTED'].includes(trip.status)) {
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
      include: { driver: { include: { user: true, vehicle: true } } },
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
      include: { driver: { include: { user: true, vehicle: true } } },
    })
    broadcastToTrip(pk, { type: 'trip.update', status: updated.status, trip_id: pk })

    return res.json(toTrip(updated))
  }),
)

export default router
