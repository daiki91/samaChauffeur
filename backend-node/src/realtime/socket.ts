import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyAccessToken } from '../lib/jwt'
import prisma from '../lib/prisma'
import { env } from '../config/env'

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
    return { id: user.id, role: user.role, isStaff: user.isStaff, chauffeurId: user.chauffeur?.id }
  } catch {
    return null
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
      if (driverId != null && lat != null && lng != null) {
        try {
          await prisma.chauffeur.update({ where: { id: driverId }, data: { latitude: Number(lat), longitude: Number(lng), isAvailable: true } })
        } catch {
          // unknown chauffeur id — ignore, mirrors Chauffeur.DoesNotExist handling
        }
      }
      const msg = { type: 'broadcast.location', driver_id: driverId, lat, lng }
      driverNsp.to('drivers').emit('message', msg)
      driversNsp.to('drivers').emit('message', msg)
      if (driverId != null) {
        driverNsp.to(`driver_${driverId}`).emit('message', { type: 'location.update', driver_id: driverId, lat, lng })
      }
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
