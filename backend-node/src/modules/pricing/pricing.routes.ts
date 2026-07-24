import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, authenticateOptional } from '../../middleware/auth'
import { estimatePrice, NoPricingRuleError } from './pricing.service'

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

export default router
