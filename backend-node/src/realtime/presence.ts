import prisma from '../lib/prisma'

/**
 * In-memory "who is online right now" tracker for the admin presence feature.
 *
 * Deliberately not persisted — live status only makes sense for the lifetime of
 * this process. We do persist `User.lastSeenAt` when a user goes fully offline
 * (all their sockets disconnected) so admins can see "last seen" even offline.
 */

export type PresenceEntry = {
  userId: number
  username: string
  phone: string
  role: string
  socketCount: number
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
