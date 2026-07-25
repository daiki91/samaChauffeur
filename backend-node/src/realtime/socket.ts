import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyAccessToken } from '../lib/jwt'
import prisma from '../lib/prisma'
import { env } from '../config/env'
import * as presence from './presence'

/**
 * Realtime layer — port of backend/realtime (Django Channels) to Socket.io.
 *
 * Original design (channel-layer groups):
 *  - ws/realtime/driver/         DriverLocationConsumer   (verified chauffeurs only, read/write)
 *  - ws/realtime/drivers/        DriversBroadcastConsumer (clients/admin, read-only)
 *  - ws/realtime/trip/<trip_id>/ TripNotificationConsumer (passenger/driver/admin of that trip)
 *
 * Both driver + drivers consumers share the same 'drivers' broadcast group.
 * We reproduce that with a single 'drivers' Socket.io room shared by both namespaces below.
 */

let io: Server | null = null

type SocketUser = {
  id: number
  username: string
  phone: string
  role: 'CLIENT' | 'CHAUFFEUR' | 'ADMIN'
  isStaff: boolean
  chauffeurId?: number
}

async function authenticateSocket(token: string | undefined): Promise<SocketUser | null> {
  if (!token) return null
  try {
    const decoded = verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: decoded.user_id }, include: { chauffeur: true } })
    if (!user || !user.isActive) return null
    return { id: user.id, username: user.username, phone: user.phone, role: user.role, isStaff: user.isStaff, chauffeurId: user.chauffeur?.id }
  } catch {
    return null
  }
}

/** Basic sanity check for a lat/lng pair coming off the wire — finite numbers, within range. */
function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  const latN = Number(lat)
  const lngN = Number(lng)
  return Number.isFinite(latN) && Number.isFinite(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

// Position history: throttle to at most one ChauffeurLocationPing row per driver every 10s,
// tracked in-memory (module-level) rather than round-tripping the DB on every socket message.
const LOCATION_PING_THROTTLE_MS = 10_000
const lastPingAt = new Map<number, number>()

async function maybeRecordLocationPing(driverId: number, lat: number, lng: number) {
  const now = Date.now()
  const last = lastPingAt.get(driverId) ?? 0
  if (now - last < LOCATION_PING_THROTTLE_MS) return
  lastPingAt.set(driverId, now) // set before the await so a burst of updates can't slip past the throttle
  try {
    await prisma.chauffeurLocationPing.create({ data: { chauffeurId: driverId, latitude: lat, longitude: lng } })
  } catch {
    // unknown chauffeur id (e.g. deleted concurrently) — ignore, mirrors the live-position update above
  }
}

function getToken(socket: Socket): string | undefined {
  const fromAuth = socket.handshake.auth?.token as string | undefined
  const fromQuery = socket.handshake.query?.token as string | undefined
  return fromAuth || fromQuery
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.corsOrigin, credentials: true },
  })

  // ---------- /ws/realtime/driver/ (verified chauffeurs: read + write location) ----------
  const driverNsp = io.of('/ws/realtime/driver')
  driverNsp.use(async (socket, next) => {
    const user = await authenticateSocket(getToken(socket))
    if (!user) return next(new Error('unauthorized'))
    if (!user.chauffeurId) return next(new Error('forbidden'))
    const chauffeur = await prisma.chauffeur.findUnique({ where: { id: user.chauffeurId } })
    if (!chauffeur?.isVerified) return next(new Error('forbidden'))
    ;(socket.data as any).user = user
    next()
  })
  driverNsp.on('connection', (socket) => {
    socket.join('drivers')

    socket.on('location.update', async (content: { driver_id?: number; lat?: number; lng?: number }) => {
      const user = (socket.data as any).user as SocketUser
      const driverId = user.chauffeurId ?? content.driver_id
      const { lat, lng } = content
      // Reject missing driver id or non-finite / out-of-range coordinates — bad packets are
      // dropped entirely rather than written to the DB or broadcast to clients/passengers.
      if (driverId == null || !isValidCoordinate(lat, lng)) return
      const latN = Number(lat)
      const lngN = Number(lng)

      try {
        // Sockets are ordered per-connection, so the last write here is always the most
        // recent position for this connection — no extra out-of-order handling needed.
        await prisma.chauffeur.update({ where: { id: driverId }, data: { latitude: latN, longitude: lngN, isAvailable: true } })
      } catch {
        // unknown chauffeur id — ignore, mirrors Chauffeur.DoesNotExist handling
      }
      void maybeRecordLocationPing(driverId, latN, lngN)

      const msg = { type: 'broadcast.location', driver_id: driverId, lat: latN, lng: lngN }
      driverNsp.to('drivers').emit('message', msg)
      driversNsp.to('drivers').emit('message', msg)
      driverNsp.to(`driver_${driverId}`).emit('message', { type: 'location.update', driver_id: driverId, lat: latN, lng: lngN })
    })

    socket.on('disconnect', () => {
      socket.leave('drivers')
    })
  })

  // ---------- /ws/realtime/drivers/ (clients/admin: read-only broadcast of driver locations) ----------
  const driversNsp = io.of('/ws/realtime/drivers')
  driversNsp.use(async (socket, next) => {
    const user = await authenticateSocket(getToken(socket))
    if (!user) return next(new Error('unauthorized'))
    if (!(user.role === 'CLIENT' || user.isStaff || user.role === 'ADMIN')) return next(new Error('forbidden'))
    ;(socket.data as any).user = user
    next()
  })
  driversNsp.on('connection', (socket) => {
    socket.join('drivers')
    socket.on('disconnect', () => socket.leave('drivers'))
  })

  // ---------- /ws/realtime/trip/<trip_id>/ (passenger/driver/admin of that trip) ----------
  const tripNsp = io.of(/^\/ws\/realtime\/trip\/[^/]+$/)
  tripNsp.use(async (socket, next) => {
    const nsp = socket.nsp.name
    const tripId = parseInt(nsp.split('/').pop() || '', 10)
    if (!tripId) return next(new Error('bad request'))
    const user = await authenticateSocket(getToken(socket))
    if (!user) return next(new Error('unauthorized'))

    const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { driver: true } })
    if (!trip) return next(new Error('not found'))
    const allowed = user.isStaff || user.role === 'ADMIN' || trip.passengerId === user.id || (trip.driver && trip.driver.userId === user.id)
    if (!allowed) return next(new Error('forbidden'))

    ;(socket.data as any).tripId = tripId
    next()
  })
  tripNsp.on('connection', (socket) => {
    const tripId = (socket.data as any).tripId
    socket.join(`trip_${tripId}`)
    socket.on('disconnect', () => socket.leave(`trip_${tripId}`))
  })

  // ---------- /ws/realtime/presence/ (any authenticated user: "who's online" for admins) ----------
  const presenceNsp = io.of('/ws/realtime/presence')
  presenceNsp.use(async (socket, next) => {
    const user = await authenticateSocket(getToken(socket))
    if (!user) return next(new Error('unauthorized'))
    ;(socket.data as any).user = user
    next()
  })
  presenceNsp.on('connection', (socket) => {
    const user = (socket.data as any).user as SocketUser
    presence.markOnline({ id: user.id, username: user.username, phone: user.phone, role: user.role })

    if (user.role === 'ADMIN' || user.isStaff) socket.join('admins')

    presenceNsp.to('admins').emit('message', {
      type: 'presence.update',
      user_id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role,
      online: true,
    })

    socket.on('disconnect', async () => {
      await presence.markOffline(user.id)
      presenceNsp.to('admins').emit('message', {
        type: 'presence.update',
        user_id: user.id,
        online: false,
        last_seen_at: new Date().toISOString(),
      })
    })
  })

  return io
}

/** Notify the 'drivers' group — mirrors channel_layer.group_send('drivers', {...}) */
export function broadcastToDrivers(message: Record<string, any>) {
  if (!io) return
  io.of('/ws/realtime/driver').to('drivers').emit('message', message)
  io.of('/ws/realtime/drivers').to('drivers').emit('message', message)
}

/** Notify a trip's group — mirrors channel_layer.group_send(f'trip_{id}', {...}) */
export function broadcastToTrip(tripId: number, message: Record<string, any>) {
  if (!io) return
  // io.of(exactName) reuses the namespace instance created when a client connected
  // through the dynamic /ws/realtime/trip/<id> matcher above.
  io.of(`/ws/realtime/trip/${tripId}`).to(`trip_${tripId}`).emit('message', message)
}

export function getIo() {
  return io
}
