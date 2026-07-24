import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin } from '../../middleware/auth'

const router = Router()

const TX_METHODS = ['ORANGE', 'WAVE', 'FREE', 'CASH', 'CARD'] as const

function toTransaction(t: any) {
  return {
    id: t.id,
    client: t.clientId,
    amount: Number(t.amount),
    currency: t.currency,
    method: t.method,
    status: t.status,
    reference: t.reference,
    metadata: t.metadata,
    created_at: t.createdAt,
  }
}

function toPaymentMethod(pm: any) {
  return { id: pm.id, client: pm.clientId, provider: pm.provider, details: pm.details, is_default: pm.isDefault, created_at: pm.createdAt }
}

function toPayout(p: any) {
  return {
    id: p.id,
    chauffeur: p.chauffeurId,
    amount: Number(p.amount),
    status: p.status,
    scheduled_at: p.scheduledAt,
    processed_at: p.processedAt,
    metadata: p.metadata,
  }
}

async function isOwnerOrAdmin(req: any, clientId: number | null) {
  const user = req.user!
  if (user.isStaff || user.role === 'ADMIN') return true
  const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } })
  return !!profile && profile.id === clientId
}

// ---------- GET/POST /transactions/ ----------

router.get(
  '/transactions/',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user!
    if (user.isStaff || user.role === 'ADMIN') {
      const all = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } })
      return res.json(all.map(toTransaction))
    }
    const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } })
    if (!profile) return res.json([])
    const mine = await prisma.transaction.findMany({ where: { clientId: profile.id }, orderBy: { createdAt: 'desc' } })
    return res.json(mine.map(toTransaction))
  }),
)

const createTransactionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional().default('XOF'),
  method: z.enum(TX_METHODS),
  reference: z.string().optional().nullable(),
  metadata: z.any().optional(),
})

router.post(
  '/transactions/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = createTransactionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data

    let profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) {
      // auto-create client profile if missing, mirrors payments/views.py::perform_create
      profile = await prisma.clientProfile.create({ data: { userId: req.user!.id } })
    }

    const tx = await prisma.transaction.create({
      data: {
        clientId: profile.id,
        amount: d.amount,
        currency: d.currency,
        method: d.method,
        reference: d.reference ?? undefined,
        metadata: d.metadata ?? undefined,
        status: 'PENDING', // status is always forced to PENDING regardless of client input
      },
    })
    return res.status(201).json(toTransaction(tx))
  }),
)

// ---------- GET/PATCH /transactions/:pk/ ----------

router.get(
  '/transactions/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const tx = await prisma.transaction.findUnique({ where: { id: pk } })
    if (!tx) return res.status(404).json({ detail: 'Not found' })
    if (!(await isOwnerOrAdmin(req, tx.clientId))) return res.status(403).json({ detail: 'Forbidden' })
    return res.json(toTransaction(tx))
  }),
)

router.patch(
  '/transactions/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const tx = await prisma.transaction.findUnique({ where: { id: pk } })
    if (!tx) return res.status(404).json({ detail: 'Not found' })
    if (!(await isOwnerOrAdmin(req, tx.clientId))) return res.status(403).json({ detail: 'Forbidden' })
    const parsed = createTransactionSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const updated = await prisma.transaction.update({ where: { id: pk }, data: parsed.data as any })
    return res.json(toTransaction(updated))
  }),
)

// ---------- POST /transactions/:pk/validate/ ----------

router.post(
  '/transactions/:pk/validate/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    const tx = await prisma.transaction.findUnique({ where: { id: pk } })
    if (!tx) return res.status(404).json({ detail: 'Not found' })
    if (tx.status !== 'PENDING') return res.status(400).json({ detail: 'Transaction not pending' })

    const tripId = (tx.metadata as any)?.trip_id
    if (!tripId) return res.status(400).json({ detail: 'No trip associated' })

    const trip = await prisma.trip.findUnique({ where: { id: Number(tripId) } })
    if (!trip) return res.status(404).json({ detail: 'Trip not found' })

    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur || trip.driverId !== chauffeur.id) return res.status(403).json({ detail: 'Not authorized' })

    const updated = await prisma.transaction.update({ where: { id: pk }, data: { status: 'COMPLETED' } })
    return res.json(toTransaction(updated))
  }),
)

// ---------- GET /transactions/pending/driver/ ----------

router.get(
  '/transactions/pending/driver/',
  authenticate,
  asyncHandler(async (req, res) => {
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId: req.user!.id } })
    if (!chauffeur) return res.status(403).json({ detail: 'Not a chauffeur' })
    const trips = await prisma.trip.findMany({ where: { driverId: chauffeur.id }, select: { id: true } })
    const tripIds = trips.map((t) => t.id)
    const pending = await prisma.transaction.findMany({ where: { status: 'PENDING' } })
    const filtered = pending.filter((t) => tripIds.includes(Number((t.metadata as any)?.trip_id)))
    return res.json(filtered.map(toTransaction))
  }),
)

// ---------- GET/POST /methods/ ----------

router.get(
  '/methods/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.json([])
    const methods = await prisma.paymentMethod.findMany({ where: { clientId: profile.id } })
    return res.json(methods.map(toPaymentMethod))
  }),
)

const paymentMethodSchema = z.object({
  provider: z.string().min(1),
  details: z.any().optional(),
  is_default: z.boolean().optional().default(false),
})

router.post(
  '/methods/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = paymentMethodSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    const d = parsed.data
    const pm = await prisma.paymentMethod.create({
      data: { clientId: profile?.id as number, provider: d.provider, details: d.details ?? undefined, isDefault: d.is_default },
    })
    if (pm.isDefault && profile) {
      await prisma.paymentMethod.updateMany({ where: { clientId: profile.id, id: { not: pm.id } }, data: { isDefault: false } })
    }
    return res.status(201).json(toPaymentMethod(pm))
  }),
)

// ---------- GET/PATCH/DELETE /methods/:pk/ ----------

async function loadOwnedMethod(req: any, res: any, pk: number) {
  const pm = await prisma.paymentMethod.findUnique({ where: { id: pk } })
  if (!pm) {
    res.status(404).json({ detail: 'Not found' })
    return null
  }
  const user = req.user!
  if (!(user.isStaff || user.role === 'ADMIN')) {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } })
    if (!profile || pm.clientId !== profile.id) {
      res.status(403).json({ detail: 'Forbidden' })
      return null
    }
  }
  return pm
}

router.get(
  '/methods/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pm = await loadOwnedMethod(req, res, parseInt(req.params.pk, 10))
    if (!pm) return
    return res.json(toPaymentMethod(pm))
  }),
)

router.patch(
  '/methods/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pm = await loadOwnedMethod(req, res, parseInt(req.params.pk, 10))
    if (!pm) return
    const parsed = paymentMethodSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const updated = await prisma.paymentMethod.update({ where: { id: pm.id }, data: parsed.data as any })
    return res.json(toPaymentMethod(updated))
  }),
)

router.delete(
  '/methods/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pm = await loadOwnedMethod(req, res, parseInt(req.params.pk, 10))
    if (!pm) return
    await prisma.paymentMethod.delete({ where: { id: pm.id } })
    return res.status(204).end()
  }),
)

// ---------- GET/POST /payouts/ (admin) ----------

router.get(
  '/payouts/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const payouts = await prisma.payout.findMany({ orderBy: { id: 'desc' } })
    return res.json(payouts.map(toPayout))
  }),
)

const payoutSchema = z.object({
  chauffeur: z.number().int(),
  amount: z.number().positive(),
  status: z.enum(['SCHEDULED', 'PROCESSED', 'FAILED']).optional().default('SCHEDULED'),
  scheduled_at: z.string().datetime().optional().nullable(),
  metadata: z.any().optional(),
})

router.post(
  '/payouts/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = payoutSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const payout = await prisma.payout.create({
      data: {
        chauffeurId: d.chauffeur,
        amount: d.amount,
        status: d.status,
        scheduledAt: d.scheduled_at ? new Date(d.scheduled_at) : undefined,
        metadata: d.metadata ?? undefined,
      },
    })
    return res.status(201).json(toPayout(payout))
  }),
)

// ---------- GET /summary/ ----------

router.get(
  '/summary/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.json({ total_spent: 0, recent_transactions: [] })

    const agg = await prisma.transaction.aggregate({
      where: { clientId: profile.id, status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const recent = await prisma.transaction.findMany({
      where: { clientId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return res.json({
      total_spent: Number(agg._sum.amount ?? 0),
      recent_transactions: recent.map(toTransaction),
    })
  }),
)

export default router
