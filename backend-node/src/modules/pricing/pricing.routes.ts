import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, authenticateOptional } from '../../middleware/auth'
import { estimatePrice, NoPricingRuleError, resolvePromoCode, InvalidPromoCodeError } from './pricing.service'

const router = Router()

const VEHICLE_TYPES = ['CAR', 'SEDAN', 'SUV', 'MINIBUS', 'BUS'] as const
const MODES = ['PRIVATE', 'SHARED', 'BUS'] as const

function toRule(r: any) {
  return {
    id: r.id,
    vehicle_type: r.vehicleType,
    mode: r.mode,
    region: r.region,
    price_per_km: Number(r.pricePerKm),
    active: r.active,
  }
}

// ---------- GET/POST /rules/ ----------

router.get(
  '/rules/',
  authenticate,
  asyncHandler(async (_req, res) => {
    const rules = await prisma.pricingRule.findMany({ orderBy: [{ vehicleType: 'asc' }, { mode: 'asc' }, { region: 'asc' }] })
    return res.json(rules.map(toRule))
  }),
)

const ruleSchema = z.object({
  vehicle_type: z.enum(VEHICLE_TYPES),
  mode: z.enum(MODES).optional().default('PRIVATE'),
  region: z.string().optional().nullable(),
  price_per_km: z.number().positive(),
  active: z.boolean().optional().default(true),
})

router.post(
  '/rules/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user!.isStaff) return res.status(403).json({ detail: 'Admin only' })
    const parsed = ruleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const rule = await prisma.pricingRule.create({
      data: { vehicleType: d.vehicle_type, mode: d.mode, region: d.region ?? null, pricePerKm: d.price_per_km, active: d.active },
    })
    return res.status(201).json(toRule(rule))
  }),
)

// ---------- POST /estimate/ (public) ----------

const estimateSchema = z.object({
  distance_km: z.number().nonnegative(),
  vehicle_type: z.enum(VEHICLE_TYPES),
  mode: z.enum(MODES).optional().default('PRIVATE'),
  region: z.string().optional(),
})

router.post(
  '/estimate/',
  authenticateOptional,
  asyncHandler(async (req, res) => {
    const parsed = estimateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    try {
      const result = await estimatePrice(d.distance_km, d.vehicle_type, d.mode, d.region)
      return res.json(result)
    } catch (e) {
      if (e instanceof NoPricingRuleError) return res.status(400).json({ detail: 'No pricing rule found' })
      throw e
    }
  }),
)

// ---------- POST /validate-code/ (auth) — preview a promo/referral code before booking ----------

const validateCodeSchema = z.object({ code: z.string().min(1) })

router.post(
  '/validate-code/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = validateCodeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    try {
      const resolved = await resolvePromoCode(parsed.data.code, req.user!.id)
      return res.json({ valid: true, discount_pct: resolved.discountPct, kind: resolved.kind })
    } catch (e) {
      if (e instanceof InvalidPromoCodeError) return res.json({ valid: false, detail: e.message })
      throw e
    }
  }),
)

// ---------- GET/POST /promo-codes/ (admin) ----------

function toPromoCode(p: any) {
  return {
    id: p.id,
    code: p.code,
    discount_pct: p.discountPct,
    max_uses: p.maxUses,
    used_count: p.usedCount,
    active: p.active,
    expires_at: p.expiresAt,
    created_at: p.createdAt,
  }
}

router.get(
  '/promo-codes/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user!.isStaff) return res.status(403).json({ detail: 'Admin only' })
    const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
    return res.json(codes.map(toPromoCode))
  }),
)

const promoCodeSchema = z.object({
  code: z.string().min(3).max(20),
  discount_pct: z.number().int().min(1).max(100),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
})

router.post(
  '/promo-codes/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user!.isStaff) return res.status(403).json({ detail: 'Admin only' })
    const parsed = promoCodeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const d = parsed.data
    const code = await prisma.promoCode.create({
      data: {
        code: d.code.trim().toUpperCase(),
        discountPct: d.discount_pct,
        maxUses: d.max_uses ?? undefined,
        expiresAt: d.expires_at ? new Date(d.expires_at) : undefined,
      },
    })
    return res.status(201).json(toPromoCode(code))
  }),
)

// ---------- POST /promo-codes/:pk/toggle/ (admin) ----------

router.post(
  '/promo-codes/:pk/toggle/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user!.isStaff) return res.status(403).json({ detail: 'Admin only' })
    const pk = parseInt(req.params.pk, 10)
    if (Number.isNaN(pk)) return res.status(400).json({ detail: 'Invalid id' })
    const existing = await prisma.promoCode.findUnique({ where: { id: pk } })
    if (!existing) return res.status(404).json({ detail: 'Not found' })
    const updated = await prisma.promoCode.update({ where: { id: pk }, data: { active: !existing.active } })
    return res.json(toPromoCode(updated))
  }),
)

export default router
