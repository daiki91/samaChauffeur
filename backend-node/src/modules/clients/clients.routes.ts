import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, requireAdmin } from '../../middleware/auth'
import { resolvePromoCode, InvalidPromoCodeError } from '../pricing/pricing.service'
import { getOrCreateProfile } from './rewards.service'

const router = Router()

function toProfile(p: any) {
  return {
    id: p.id,
    user: p.userId,
    photo: p.photo,
    is_active: p.isActive,
    language: p.language,
    referral_code: p.referralCode,
    created_at: p.createdAt,
    pending_promo_code: p.pendingPromoCode,
    pending_promo_discount_pct: p.pendingPromoDiscountPct,
  }
}

// Deterministic from userId (already unique) — no collision handling ever needed.
function referralCodeFor(userId: number) {
  return `SC${userId.toString(36).toUpperCase()}`
}

function toPaymentMethod(pm: any) {
  return { id: pm.id, client: pm.clientId, provider: pm.provider, details: pm.details, is_default: pm.isDefault, created_at: pm.createdAt }
}

function toSupportTicket(t: any) {
  return { id: t.id, client: t.clientId, trip: t.tripId, title: t.title, description: t.description, status: t.status, created_at: t.createdAt }
}

// ---------- GET/POST/PATCH /profile/ (current user) ----------

router.get(
  '/profile/',
  authenticate,
  asyncHandler(async (req, res) => {
    let profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) {
      profile = await prisma.clientProfile.create({ data: { userId: req.user!.id, referralCode: referralCodeFor(req.user!.id) } })
    } else if (!profile.referralCode) {
      // Backfill for profiles created before the referral system existed.
      profile = await prisma.clientProfile.update({ where: { id: profile.id }, data: { referralCode: referralCodeFor(req.user!.id) } })
    }
    return res.json(toProfile(profile))
  }),
)

const profileSchema = z.object({
  photo: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  language: z.enum(['fr', 'wo']).optional(),
})

router.post(
  '/profile/',
  authenticate,
  asyncHandler(async (req, res) => {
    const existing = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (existing) return res.status(400).json({ detail: 'Profile already exists' })
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const profile = await prisma.clientProfile.create({
      data: { userId: req.user!.id, photo: d.photo ?? undefined, isActive: d.is_active ?? true, language: d.language ?? 'fr', referralCode: referralCodeFor(req.user!.id) },
    })
    return res.status(201).json(toProfile(profile))
  }),
)

router.patch(
  '/profile/',
  authenticate,
  asyncHandler(async (req, res) => {
    const existing = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!existing) return res.status(404).json({ detail: 'No profile' })
    const parsed = profileSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d: any = { ...parsed.data }
    if ('is_active' in d) {
      d.isActive = d.is_active
      delete d.is_active
    }
    const profile = await prisma.clientProfile.update({ where: { userId: req.user!.id }, data: d })
    return res.json(toProfile(profile))
  }),
)

// ---------- POST /promo-code/ (current user) ----------
// Le code promo n'est plus saisi à chaque course : il est enregistré une fois ici et
// s'applique automatiquement à la prochaine course (trips.routes.ts POST /create/), qui le
// consomme et vide ce slot. Totalement indépendant des cadeaux de progression km
// (rewards.service.ts, pendingGiftDiscountPct) — enregistrer un code ici ne les affecte jamais.
// Pas de "retirer" : entrer un nouveau code remplace simplement l'ancien.

const promoCodeSchema = z.object({ code: z.string().min(1) })

router.post(
  '/promo-code/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = promoCodeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())

    let resolved
    try {
      resolved = await resolvePromoCode(parsed.data.code, req.user!.id)
    } catch (e) {
      if (e instanceof InvalidPromoCodeError) return res.json({ valid: false, detail: e.message })
      throw e
    }

    const profile = await getOrCreateProfile(req.user!.id)
    const code = parsed.data.code.trim().toUpperCase()
    await prisma.clientProfile.update({
      where: { id: profile.id },
      data: {
        pendingPromoCode: code,
        pendingPromoDiscountPct: resolved.discountPct,
        pendingPromoId: resolved.kind === 'PROMO' ? resolved.promo!.id : null,
      },
    })

    return res.json({ valid: true, discount_pct: resolved.discountPct })
  }),
)

// ---------- GET/POST /profiles/ (admin) ----------

const adminProfileSchema = z.object({
  user: z.number().int(),
  photo: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  language: z.enum(['fr', 'wo']).optional(),
})

router.get(
  '/profiles/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const profiles = await prisma.clientProfile.findMany({ orderBy: { id: 'asc' } })
    return res.json(profiles.map(toProfile))
  }),
)

router.post(
  '/profiles/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminProfileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const profile = await prisma.clientProfile.create({
      data: { userId: d.user, photo: d.photo ?? undefined, isActive: d.is_active ?? true, language: d.language ?? 'fr' },
    })
    return res.status(201).json(toProfile(profile))
  }),
)

// ---------- GET/POST /payment-methods/ ----------

router.get(
  '/payment-methods/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.status(404).json({ detail: 'No profile' })
    const methods = await prisma.paymentMethod.findMany({ where: { clientId: profile.id } })
    return res.json(methods.map(toPaymentMethod))
  }),
)

const paymentMethodSchema = z.object({
  provider: z.string().min(1).optional(),
  method: z.string().min(1).optional(), // backwards-compat alias for provider
  details: z.any().optional(),
  data: z.any().optional(), // backwards-compat alias for details
  is_default: z.boolean().optional().default(false),
})

router.post(
  '/payment-methods/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.status(404).json({ detail: 'No profile' })
    const parsed = paymentMethodSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const provider = d.provider ?? d.method
    const details = d.details ?? d.data
    if (!provider) return res.status(400).json({ provider: ['This field is required.'] })

    const pm = await prisma.paymentMethod.create({
      data: { clientId: profile.id, provider, details: details ?? undefined, isDefault: d.is_default },
    })
    if (pm.isDefault) {
      await prisma.paymentMethod.updateMany({ where: { clientId: profile.id, id: { not: pm.id } }, data: { isDefault: false } })
    }
    return res.status(201).json(toPaymentMethod(pm))
  }),
)

// ---------- POST /tickets/ (support tickets) ----------

const supportTicketSchema = z.object({
  trip: z.number().int().optional().nullable(),
  title: z.string().min(1),
  description: z.string().min(1),
})

router.post(
  '/tickets/',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) return res.status(404).json({ detail: 'No profile' })
    const parsed = supportTicketSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const ticket = await prisma.supportTicket.create({
      data: { clientId: profile.id, tripId: d.trip ?? undefined, title: d.title, description: d.description },
    })
    return res.status(201).json(toSupportTicket(ticket))
  }),
)

export default router
