import prisma from '../../lib/prisma'

// Cadeaux basés sur les km parcourus: après chaque checkpoint, le prochain est placé à un
// écart aléatoire (et légèrement croissant avec le nombre déjà atteints) pour donner
// l'impression que la route peut continuer à l'infini, de façon imprévisible. Le tout premier
// checkpoint est fixé à 1 km (ClientProfile.nextCheckpointKm par défaut), donc pas de gap ici.
const CHECKPOINT_MIN_GAP_KM = 8
const CHECKPOINT_MAX_GAP_KM = 25
const REWARD_CHANCE = 0.5
const REWARD_DISCOUNTS = [5, 10, 15, 20]

function randomGapKm(checkpointsReached: number) {
  const growth = Math.min(checkpointsReached * 1.5, 20)
  return CHECKPOINT_MIN_GAP_KM + growth + Math.random() * (CHECKPOINT_MAX_GAP_KM - CHECKPOINT_MIN_GAP_KM)
}

function rollReward(): number | null {
  if (Math.random() > REWARD_CHANCE) return null
  return REWARD_DISCOUNTS[Math.floor(Math.random() * REWARD_DISCOUNTS.length)]
}

export async function getOrCreateProfile(userId: number) {
  let profile = await prisma.clientProfile.findUnique({ where: { userId } })
  if (!profile) profile = await prisma.clientProfile.create({ data: { userId } })
  return profile
}

// Called when a trip completes: rolls forward the client's cumulative distance and awards
// any checkpoints crossed along the way (a single trip can cross more than one if it's long
// enough, e.g. the very first ride past the 1km starting checkpoint).
export async function recordDistance(userId: number, distanceKm: number) {
  let profile = await getOrCreateProfile(userId)
  let total = profile.totalDistanceKm + Math.max(0, distanceKm)
  let lastCheckpoint = profile.lastCheckpointKm
  let nextCheckpoint = profile.nextCheckpointKm
  const newRewards: { km: number; discountPct: number | null }[] = []
  let checkpointsReached = await prisma.checkpointReward.count({ where: { clientId: profile.id } })

  // This slot is entirely separate from any saved promo code (clients.routes.ts POST
  // /promo-code/) — winning a gift here never touches it, and vice versa.
  let pendingGiftDiscountPct = profile.pendingGiftDiscountPct

  while (total >= nextCheckpoint) {
    const discountPct = rollReward()
    newRewards.push({ km: nextCheckpoint, discountPct })
    checkpointsReached += 1
    if (discountPct != null) {
      // A freshly won gift replaces a previous unclaimed one — single active gift slot.
      pendingGiftDiscountPct = discountPct
    }
    lastCheckpoint = nextCheckpoint
    nextCheckpoint = nextCheckpoint + randomGapKm(checkpointsReached)
  }

  const wonAGift = newRewards.some((r) => r.discountPct != null)
  profile = await prisma.clientProfile.update({
    where: { id: profile.id },
    data: {
      totalDistanceKm: total,
      lastCheckpointKm: lastCheckpoint,
      nextCheckpointKm: nextCheckpoint,
      pendingGiftDiscountPct: wonAGift ? pendingGiftDiscountPct : undefined,
    },
  })

  if (newRewards.length > 0) {
    await prisma.checkpointReward.createMany({
      data: newRewards.map((r) => ({ clientId: profile!.id, km: r.km, discountPct: r.discountPct ?? undefined })),
    })
  }

  const created = newRewards.length
    ? await prisma.checkpointReward.findMany({
        where: { clientId: profile.id },
        orderBy: { id: 'desc' },
        take: newRewards.length,
      })
    : []

  return created.reverse().map((r) => ({ km: r.km, discount_pct: r.discountPct }))
}

export async function getRewardsStatus(userId: number) {
  const profile = await getOrCreateProfile(userId)
  const history = await prisma.checkpointReward.findMany({
    where: { clientId: profile.id },
    orderBy: { createdAt: 'desc' },
  })

  return {
    total_distance_km: profile.totalDistanceKm,
    last_checkpoint_km: profile.lastCheckpointKm,
    next_checkpoint_km: profile.nextCheckpointKm,
    pending_discount:
      profile.pendingGiftDiscountPct != null ? { pct: profile.pendingGiftDiscountPct, label: 'Cadeau progression' } : null,
    history: history.map((h) => ({ km: h.km, discount_pct: h.discountPct, created_at: h.createdAt })),
  }
}
