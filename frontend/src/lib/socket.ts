import { io, Socket } from 'socket.io-client'

const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || 'https://samachauffeur.onrender.com'

function connect(namespace: string): Socket | null {
  const token = localStorage.getItem('access')
  if (!token) return null
  return io(`${SOCKET_BASE}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
  })
}

/** Verified chauffeurs only — read + write location (mirrors ws/realtime/driver/) */
export function connectDriverSocket() {
  return connect('/ws/realtime/driver')
}

/** Clients/admin — read-only driver location broadcasts (mirrors ws/realtime/drivers/) */
export function connectDriversSocket() {
  return connect('/ws/realtime/drivers')
}

/** Passenger/driver/admin of a given trip (mirrors ws/realtime/trip/<id>/) */
export function connectTripSocket(tripId: number | string) {
  return connect(`/ws/realtime/trip/${tripId}`)
}

/** Any authenticated user — fire-and-forget presence heartbeat (mirrors ws/realtime/presence/) */
export function connectPresenceSocket() {
  return connect('/ws/realtime/presence')
}
