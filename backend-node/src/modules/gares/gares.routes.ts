import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin } from '../../middleware/auth'

const router = Router()

function toStation(s: any) {
  return { id: s.id, name: s.name, city: s.city, latitude: s.latitude, longitude: s.longitude }
}
function toLine(l: any) {
  return { id: l.id, name: l.name, origin: l.originId, destination: l.destinationId }
}
function toSchedule(s: any) {
  return {
    id: s.id,
    line: s.lineId,
    departure_time: s.departureTime,
    arrival_time: s.arrivalTime,
    days_of_week: s.daysOfWeek,
    price_base: Number(s.priceBase),
  }
}

// ---------- Stations ----------

const stationSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
})

router.get(
  '/stations/',
  asyncHandler(async (_req, res) => res.json((await prisma.station.findMany({ orderBy: { id: 'asc' } })).map(toStation))),
)
router.post(
  '/stations/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = stationSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const s = await prisma.station.create({ data: parsed.data })
    return res.status(201).json(toStation(s))
  }),
)
router.get(
  '/stations/:pk/',
  asyncHandler(async (req, res) => {
    const s = await prisma.station.findUnique({ where: { id: parseInt(req.params.pk, 10) } })
    if (!s) return res.status(404).json({ detail: 'Not found' })
    return res.json(toStation(s))
  }),
)
router.put(
  '/stations/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = stationSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const s = await prisma.station.update({ where: { id: parseInt(req.params.pk, 10) }, data: parsed.data })
    return res.json(toStation(s))
  }),
)
router.patch(
  '/stations/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = stationSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const s = await prisma.station.update({ where: { id: parseInt(req.params.pk, 10) }, data: parsed.data })
    return res.json(toStation(s))
  }),
)
router.delete(
  '/stations/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.station.delete({ where: { id: parseInt(req.params.pk, 10) } })
    return res.status(204).end()
  }),
)

// ---------- Lines ----------

const lineSchema = z.object({
  name: z.string().min(1),
  origin: z.number().int(),
  destination: z.number().int(),
})

router.get(
  '/lines/',
  asyncHandler(async (_req, res) => res.json((await prisma.line.findMany({ orderBy: { id: 'asc' } })).map(toLine))),
)
router.post(
  '/lines/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = lineSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const line = await prisma.line.create({ data: { name: d.name, originId: d.origin, destinationId: d.destination } })
    return res.status(201).json(toLine(line))
  }),
)
router.get(
  '/lines/:pk/',
  asyncHandler(async (req, res) => {
    const l = await prisma.line.findUnique({ where: { id: parseInt(req.params.pk, 10) } })
    if (!l) return res.status(404).json({ detail: 'Not found' })
    return res.json(toLine(l))
  }),
)
router.put(
  '/lines/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = lineSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const l = await prisma.line.update({ where: { id: parseInt(req.params.pk, 10) }, data: { name: d.name, originId: d.origin, destinationId: d.destination } })
    return res.json(toLine(l))
  }),
)
router.patch(
  '/lines/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = lineSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d: any = { ...parsed.data }
    if ('origin' in d) {
      d.originId = d.origin
      delete d.origin
    }
    if ('destination' in d) {
      d.destinationId = d.destination
      delete d.destination
    }
    const l = await prisma.line.update({ where: { id: parseInt(req.params.pk, 10) }, data: d })
    return res.json(toLine(l))
  }),
)
router.delete(
  '/lines/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.line.delete({ where: { id: parseInt(req.params.pk, 10) } })
    return res.status(204).end()
  }),
)

// ---------- Schedules ----------

const scheduleSchema = z.object({
  line: z.number().int(),
  departure_time: z.string().min(1),
  arrival_time: z.string().min(1),
  days_of_week: z.string().optional().default('Mon-Fri'),
  price_base: z.number().optional().default(0),
})

router.get(
  '/schedules/',
  asyncHandler(async (_req, res) => res.json((await prisma.schedule.findMany({ orderBy: { id: 'asc' } })).map(toSchedule))),
)
router.post(
  '/schedules/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = scheduleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const s = await prisma.schedule.create({
      data: { lineId: d.line, departureTime: d.departure_time, arrivalTime: d.arrival_time, daysOfWeek: d.days_of_week, priceBase: d.price_base },
    })
    return res.status(201).json(toSchedule(s))
  }),
)
router.get(
  '/schedules/:pk/',
  asyncHandler(async (req, res) => {
    const s = await prisma.schedule.findUnique({ where: { id: parseInt(req.params.pk, 10) } })
    if (!s) return res.status(404).json({ detail: 'Not found' })
    return res.json(toSchedule(s))
  }),
)
router.put(
  '/schedules/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = scheduleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const s = await prisma.schedule.update({
      where: { id: parseInt(req.params.pk, 10) },
      data: { lineId: d.line, departureTime: d.departure_time, arrivalTime: d.arrival_time, daysOfWeek: d.days_of_week, priceBase: d.price_base },
    })
    return res.json(toSchedule(s))
  }),
)
router.patch(
  '/schedules/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = scheduleSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d: any = { ...parsed.data }
    if ('line' in d) {
      d.lineId = d.line
      delete d.line
    }
    if ('departure_time' in d) {
      d.departureTime = d.departure_time
      delete d.departure_time
    }
    if ('arrival_time' in d) {
      d.arrivalTime = d.arrival_time
      delete d.arrival_time
    }
    if ('days_of_week' in d) {
      d.daysOfWeek = d.days_of_week
      delete d.days_of_week
    }
    if ('price_base' in d) {
      d.priceBase = d.price_base
      delete d.price_base
    }
    const s = await prisma.schedule.update({ where: { id: parseInt(req.params.pk, 10) }, data: d })
    return res.json(toSchedule(s))
  }),
)
router.delete(
  '/schedules/:pk/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.schedule.delete({ where: { id: parseInt(req.params.pk, 10) } })
    return res.status(204).end()
  }),
)

export default router
