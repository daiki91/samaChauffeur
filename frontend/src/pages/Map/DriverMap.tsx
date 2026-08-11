import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket, connectDriversSocket } from '../../lib/socket'
import { useGeolocation } from '../../lib/useGeolocation'
import { carIcon, originIcon, destinationIcon, stopIcon, meIcon } from '../../lib/mapIcons'
import { Locate } from 'lucide-react'

type Point = { lat: number; lng: number }

type Props = {
  initialDrivers?: any[]
  /** 'driver' connects to the write-enabled channel (chauffeur sending its own position).
   *  'viewer' (default) connects to the read-only broadcast channel (clients/admin). */
  role?: 'driver' | 'viewer'
  /** Wrap in a full standalone page card (used by the /map route). Embed views pass false. */
  standalone?: boolean
  height?: string
  /** Tailwind height classes (e.g. responsive breakpoints) — takes over from `height` when set. */
  heightClassName?: string
  origin?: Point | null
  destination?: Point | null
  stops?: Point[]
  route?: [number, number][] | null
  title?: string
  onSocketError?: (message: string) => void
}

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)])
  return null
}

function RecenterButton({ target }: { target: Point | null }) {
  const map = useMap()
  if (!target) return null
  return (
    <button
      type="button"
      onClick={() => map.setView([target.lat, target.lng], 15)}
      className="absolute z-[400] bottom-4 right-4 grid place-items-center w-10 h-10 rounded-full bg-white shadow-floating text-brand-600 hover:bg-brand-50"
      title="Recentrer sur ma position"
    >
      <Locate size={18} />
    </button>
  )
}

export default function DriverMap({
  initialDrivers = [],
  role = 'viewer',
  standalone = true,
  height = '70vh',
  heightClassName,
  origin,
  destination,
  stops = [],
  route,
  title = 'Carte — positions en temps réel',
  onSocketError,
}: Props) {
  const [markers, setMarkers] = useState<any[]>(initialDrivers)
  const socketRef = useRef<Socket | null>(null)
  const { position: myPosition } = useGeolocation({ enabled: true })
  const lastSent = useRef<number>(0)

  useEffect(() => {
    const socket = role === 'driver' ? connectDriverSocket() : connectDriversSocket()
    if (!socket) return
    socketRef.current = socket

    socket.on('message', (data: any) => {
      if (data.type === 'broadcast.location') {
        setMarkers((m) => {
          const existing = m.find((x) => x.driver_id === data.driver_id)
          return [...m.filter((x) => x.driver_id !== data.driver_id), { ...existing, lat: data.lat, lng: data.lng, driver_id: data.driver_id }]
        })
      }
    })
    socket.on('connect_error', (err: any) => {
      onSocketError?.(err?.message === 'forbidden' ? 'Votre profil chauffeur doit être vérifié par un admin.' : 'Connexion temps réel impossible.')
    })

    return () => {
      socket.disconnect()
    }
  }, [role])

  // Driver role: stream real GPS position to the server as it changes (throttled to ~ every 4s).
  useEffect(() => {
    if (role !== 'driver' || !myPosition) return
    const now = Date.now()
    if (now - lastSent.current < 4000) return
    lastSent.current = now
    socketRef.current?.emit('location.update', { lat: myPosition.lat, lng: myPosition.lng })
  }, [role, myPosition])

  const fitPoints = useMemo(() => {
    const pts: Point[] = []
    if (origin) pts.push(origin)
    pts.push(...stops)
    if (destination) pts.push(destination)
    if (pts.length === 0 && myPosition) pts.push(myPosition)
    return pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, JSON.stringify(stops), myPosition])

  const mapBody = (
    <div className={`relative z-0 isolate rounded-2xl overflow-hidden ${heightClassName || ''}`} style={heightClassName ? undefined : { height }}>
      <MapContainer
        center={[myPosition?.lat ?? 14.7, myPosition?.lng ?? -17.45]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FitBounds points={fitPoints} />

        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#f2590e', weight: 5, opacity: 0.85 }} />}

        {myPosition && (
          <Marker position={[myPosition.lat, myPosition.lng]} icon={meIcon}>
            <Popup>Vous êtes ici</Popup>
          </Marker>
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon()}>
            <Popup>Départ</Popup>
          </Marker>
        )}
        {stops.map((s, i) => (
          <Marker key={`stop-${i}-${s.lat}-${s.lng}`} position={[s.lat, s.lng]} icon={stopIcon(i + 1)}>
            <Popup>Arrêt {i + 1}</Popup>
          </Marker>
        ))}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()}>
            <Popup>Arrivée</Popup>
          </Marker>
        )}

        {markers.map((m) => (
          <Marker key={m.driver_id} position={[m.lat, m.lng]} icon={carIcon(m.vehicle?.type)}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-stone-800">{m.username || `Chauffeur #${m.driver_id}`}</div>
                {m.vehicle?.type && (
                  <div className="text-stone-500">
                    {m.vehicle.type}
                    {m.vehicle.plate_number ? ` · ${m.vehicle.plate_number}` : ''}
                  </div>
                )}
                {m.phone && <div className="text-stone-400 text-xs mt-0.5">{m.phone}</div>}
              </div>
            </Popup>
          </Marker>
        ))}

        <RecenterButton target={myPosition} />
      </MapContainer>
    </div>
  )

  if (!standalone) return mapBody

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="bg-white p-4 rounded-2xl shadow-card">
        <h2 className="text-lg font-semibold text-stone-900 mb-3">{title}</h2>
        {mapBody}
      </div>
    </div>
  )
}
