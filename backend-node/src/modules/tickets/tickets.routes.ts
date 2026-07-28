import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin } from '../../middleware/auth'

const router = Router()

function toTicket(t: any) {
  return {
    id: t.id,
    passenger: t.passengerId,
    line: t.lineId,
    seat_number: t.seatNumber,
    status: t.status,
    issued_at: t.issuedAt,
    price: Number(t.price),
  }
}

// ---------- GET/POST / (own tickets) ----------

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.json([])
    const tickets = await prisma.ticket.findMany({ where: { passengerId: profile.id }, orderBy: { id: 'desc' } })
    return res.json(tickets.map(toTicket))
  }),
)

const ticketSchema = z.object({
  line: z.number().int(),
  seat_number: z.string().optional().nullable(),
  price: z.number().nonnegative(),
  status: z.string().optional().default('ISSUED'),
})

router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = ticketSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    const d = parsed.data
    const ticket = await prisma.ticket.create({
      data: {
        passengerId: profile?.id as number,
        lineId: d.line,
        seatNumber: d.seat_number ?? undefined,
        price: d.price,
        status: d.status,
      },
    })
    return res.status(201).json(toTicket(ticket))
  }),
)

// ---------- GET/PATCH /:pk/ ----------

router.get(
  '/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const ticket = await prisma.ticket.findUnique({ where: { id: pk } })
    if (!ticket) return res.status(404).json({ detail: 'Not found' })
    const user = req.user!
    if (!(user.isStaff || user.role === 'ADMIN')) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } })
      if (!profile || ticket.passengerId !== profile.id) return res.status(403).json({ detail: 'Forbidden' })
    }
    return res.json(toTicket(ticket))
  }),
)

router.patch(
  '/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const ticket = await prisma.ticket.findUnique({ where: { id: pk } })
    if (!ticket) return res.status(404).json({ detail: 'Not found' })
    const user = req.user!
    if (!(user.isStaff || user.role === 'ADMIN')) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } })
      if (!profile || ticket.passengerId !== profile.id) return res.status(403).json({ detail: 'Forbidden' })
    }
    const parsed = ticketSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d: any = { ...parsed.data }
    if ('line' in d) {
      d.lineId = d.line
      delete d.line
    }
    if ('seat_number' in d) {
      d.seatNumber = d.seat_number
      delete d.seat_number
    }
    const updated = await prisma.ticket.update({ where: { id: pk }, data: d })
    return res.json(toTicket(updated))
  }),
)

// ---------- GET/POST /admin/ ----------

router.get(
  '/admin/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const tickets = await prisma.ticket.findMany({ orderBy: { id: 'desc' } })
    return res.json(tickets.map(toTicket))
  }),
)

router.post(
  '/admin/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = ticketSchema.extend({ passenger: z.number().int() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const ticket = await prisma.ticket.create({
      data: { passengerId: d.passenger, lineId: d.line, seatNumber: d.seat_number ?? undefined, price: d.price, status: d.status },
    })
    return res.status(201).json(toTicket(ticket))
  }),
)

export default router
