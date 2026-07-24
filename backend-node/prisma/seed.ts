import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Default pricing rules so /api/pricing/estimate/ and trip creation work out of the box.
  const rules: Array<{ vehicleType: any; mode: any; pricePerKm: number }> = [
    { vehicleType: 'CAR', mode: 'PRIVATE', pricePerKm: 300 },
    { vehicleType: 'CAR', mode: 'SHARED', pricePerKm: 150 },
    { vehicleType: 'SEDAN', mode: 'PRIVATE', pricePerKm: 400 },
    { vehicleType: 'SUV', mode: 'PRIVATE', pricePerKm: 500 },
    { vehicleType: 'MINIBUS', mode: 'SHARED', pricePerKm: 100 },
    { vehicleType: 'BUS', mode: 'BUS', pricePerKm: 50 },
  ]

  for (const r of rules) {
    const existing = await prisma.pricingRule.findFirst({ where: { vehicleType: r.vehicleType, mode: r.mode, region: null } })
    if (!existing) {
      await prisma.pricingRule.create({ data: { ...r, region: null, active: true } })
      console.log(`Created pricing rule: ${r.vehicleType}/${r.mode} = ${r.pricePerKm} XOF/km`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
