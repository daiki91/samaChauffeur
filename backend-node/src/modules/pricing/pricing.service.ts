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

/** Port of pricing/services.py::estimate_price */
export async function estimatePrice(distanceKm: number, vehicleType: string, mode = 'PRIVATE', region?: string | null) {
  const perKm = await findPricePerKm(vehicleType, mode, region)
  const price = Math.round(distanceKm * perKm * 100) / 100
  return {
    distance_km: Math.round(distanceKm * 1000) / 1000,
    price_per_km: perKm,
    price,
  }
}
