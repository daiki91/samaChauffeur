import prisma from '../../lib/prisma'

export class NoPricingRuleError extends Error {
  constructor(msg = 'No pricing rule found for vehicle_type') {
    super(msg)
    this.name = 'NoPricingRuleError'
  }
}

/** Port of pricing/services.py::find_price_per_km — most specific active rule wins. */
export async function findPricePerKm(vehicleType: string, mode: string, region?: string | null): Promise<number> {
  if (region) {
    const rule = await prisma.pricingRule.findFirst({
      where: { vehicleType: vehicleType as any, mode: mode as any, active: true, region: { equals: region, mode: 'insensitive' } },
    })
    if (rule) return Number(rule.pricePerKm)
  }

  const ruleNoRegion = await prisma.pricingRule.findFirst({
    where: { vehicleType: vehicleType as any, mode: mode as any, active: true, region: null },
  })
  if (ruleNoRegion) return Number(ruleNoRegion.pricePerKm)

  const fallback = await prisma.pricingRule.findFirst({ where: { vehicleType: vehicleType as any, active: true } })
  if (fallback) return Number(fallback.pricePerKm)

  throw new NoPricingRuleError()
}

// How much the final fare can realistically swing from the flat-rate estimate — standing in
// for traffic and route variability we don't have real telemetry for yet. Applied symmetrically
// so the quoted range brackets the point estimate rather than always skewing one way.
const PRICE_VARIANCE = 0.12

export class InvalidPromoCodeError extends Error {
  constructor(msg = 'Code promo invalide') {
    super(msg)
    this.name = 'InvalidPromoCodeError'
  }
}

// Redeeming a friend's referral code always gives this flat discount — simpler than a
// second admin-configurable rate, and referral codes aren't admin-managed rows anyway.
const REFERRAL_DISCOUNT_PCT = 10

/**
 * Resolves a code the passenger typed in at booking time to a discount percentage.
 * Tries an admin-issued PromoCode first, then falls back to another user's personal
 * referral code (ClientProfile.referralCode) — a user can't redeem their own code.
 */
export async function resolvePromoCode(code: string, userId: number): Promise<{ discountPct: number; kind: 'PROMO' | 'REFERRAL'; promo?: { id: number } }> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) throw new InvalidPromoCodeError()

  const promo = await prisma.promoCode.findUnique({ where: { code: normalized } })
  if (promo) {
    if (!promo.active) throw new InvalidPromoCodeError('Ce code promo est désactivé')
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) throw new InvalidPromoCodeError('Ce code promo a expiré')
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw new InvalidPromoCodeError("Ce code promo n'est plus disponible")
    return { discountPct: promo.discountPct, kind: 'PROMO', promo: { id: promo.id } }
  }

  const referrer = await prisma.clientProfile.findUnique({ where: { referralCode: normalized } })
  if (referrer) {
    if (referrer.userId === userId) throw new InvalidPromoCodeError('Vous ne pouvez pas utiliser votre propre code de parrainage')
    return { discountPct: REFERRAL_DISCOUNT_PCT, kind: 'REFERRAL' }
  }

  throw new InvalidPromoCodeError()
}

/** Port of pricing/services.py::estimate_price */
export async function estimatePrice(distanceKm: number, vehicleType: string, mode = 'PRIVATE', region?: string | null) {
  const perKm = await findPricePerKm(vehicleType, mode, region)
  const price = Math.round(distanceKm * perKm * 100) / 100
  return {
    distance_km: Math.round(distanceKm * 1000) / 1000,
    price_per_km: perKm,
    price,
    price_min: Math.round(price * (1 - PRICE_VARIANCE)),
    price_max: Math.round(price * (1 + PRICE_VARIANCE)),
  }
}
