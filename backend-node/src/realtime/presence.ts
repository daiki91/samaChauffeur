import prisma from '../lib/prisma'

/**
 * In-memory "who is online right now" tracker for the admin presence feature.
 *
 * Deliberately not persisted — live status only makes sense for the lifetime of
 * this process. We do persist `User.lastSeenAt` when a user goes fully offline
 * (all their sockets disconnected) so admins can see "last seen" even offline.
 *
 * Also tracks the last live position reported over the '/ws/realtime/presence'
 * socket (any authenticated user — client or chauffeur). That live position is
 * mirrored to `User.lastLatitude/lastLongitude/lastLocationAt` on every update,
 * so the admin map always has a "last known location" to fall back on once the
 * user disconnects — see GET /api/auth/users/locations/.
 */

export type PresenceEntry = {
  userId: number
  username: string
  phone: string
  role: string
  socketCount: number
  latitude?: number
  longitude?: number
}

const online = new Map<number, PresenceEntry>()

export function markOnline(user: { id: number; username: string; phone: string; role: string }) {
  const existing = online.get(user.id)
  if (existing) {
    existing.socketCount += 1
    return
  }
  online.set(user.id, { userId: user.id, username: user.username, phone: user.phone, role: user.role, socketCount: 1 })
}

/** Decrements the socket count for a user; once it hits 0, marks them offline and stamps lastSeenAt. */
export async function markOffline(userId: number) {
  const existing = online.get(userId)
  if (!existing) return
  existing.socketCount -= 1
  if (existing.socketCount > 0) return

  online.delete(userId)
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
  } catch {
    // user deleted concurrently, or DB hiccup — presence state is already correct in-memory
  }
}

export function getOnlineSnapshot(): PresenceEntry[] {
  return Array.from(online.values())
}

export function isOnline(userId: number): boolean {
  return online.has(userId)
}

export function getEntry(userId: number): PresenceEntry | undefined {
  return online.get(userId)
}

/**
 * Records a fresh position for a connected user — updates the in-memory presence entry
 * (so an admin already on the live map sees it instantly via the socket broadcast) and
 * persists it as the user's "last known location" (so it's still there once they log off).
 * Used by both the presence namespace's 'location.update' (clients + chauffeurs) and the
 * driver namespace (chauffeurs streaming their live GPS while on a trip).
 */
export async function updateLocation(userId: number, latitude: number, longitude: number) {
  const existing = online.get(userId)
  if (existing) {
    existing.latitude = latitude
    existing.longitude = longitude
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLatitude: latitude, lastLongitude: longitude, lastLocationAt: new Date() },
    })
  } catch {
    // user deleted concurrently, or DB hiccup — in-memory state (used for live broadcast) is unaffected
  }
}
