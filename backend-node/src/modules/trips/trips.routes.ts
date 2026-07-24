import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate } from '../../middleware/auth'
import { haversine } from '../../utils/haversine'
import { estimatePrice, NoPricingRuleError } from '../pricing/pricing.service'
import { broadcastToDrivers, broadcastToTrip } from '../../realtime/socket'

const router = Router()

function toTrip(t: any) {
  return {
    id: t.id,
    passenger: t.passengerId,
    driver: t.driverId,
    origin: t.origin,
    origin_lat: t.originLat,
    origin_lng: t.originLng,
    destination: t.destination,
    dest_lat: t.destLat,
    dest_lng: t.destLng,
    distance_km: t.distanceKm,
    estimated_duration: t.estimatedDuration,
    mode: t.mode,
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
      distanceKm = haversine(data.origin_lat, data.origin_lng, data.dest_lat, data.dest_lng)
      try {
        const est = await estimatePrice(distanceKm, 'CAR', data.mode)
        price = Math.round(est.price)
      } catch (e) {
        if (!(e instanceof NoPricingRuleError)) throw e
        // no pricing rule found for CAR/mode — leave price null, same as the Django view
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
    const trips = await prisma.trip.findMany({ where: { passengerId: req.user!.id }, orderBy: { createdAt: 'desc' } })
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
    const trip = await prisma.trip.findUnique({ where: { id: pk } })
    if (!trip) return res.status(404).json({ detail: 'Not found' })
    return res.json(toTrip(trip))
  }),
)

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

export default router
