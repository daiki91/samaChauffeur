import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket, connectDriversSocket } from '../../lib/socket'
import { useGeolocation } from '../../lib/useGeolocation'
import { Locate } from 'lucide-react'

// fix default icon paths for leaflet in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// One color per vehicle type so passengers can tell rides apart on the map at a glance.
const VEHICLE_MARKER_COLORS: Record<string, string> = {
  CAR: '#f2590e',
  SEDAN: '#f2590e',
  SUV: '#1f9d65',
  MINIBUS: '#de9a1f',
  BUS: '#de9a1f',
}

const CAR_SVG_PATH =
  'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'

const carIcon = (vehicleType?: string) => {
  const color = VEHICLE_MARKER_COLORS[vehicleType || ''] || '#f2590e'
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px;">
        <span class="animate-marker-pulse" style="position:absolute;inset:0;border-radius:9999px;background:${color};"></span>
        <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="${CAR_SVG_PATH}"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

const pinIcon = (color: string, label: string) =>
  L.divIcon({
    className: '',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:9999px 9999px 9999px 0;transform:rotate(45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
             <span style="transform:rotate(-45deg);color:white;font-size:11px;font-weight:700;">${label}</span>
           </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })

const meIcon = L.divIcon({ className: '', html: `<div class="live-dot"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })

type Point = { lat: number; lng: number }

type Props = {
  initialDrivers?: any[]
  /** 'driver' connects to the write-enabled channel (chauffeur sending its own position).
   *  'viewer' (default) connects to the read-only broadcast channel (clients/admin). */
  role?: 'driver' | 'viewer'
  /** Wrap in a full standalone page card (used by the /map route). Embed views pass false. */
  standalone?: boolean
  height?: string
  origin?: Point | null
  destination?: Point | null
  route?: [number, number][] | null
  title?: string
  onSocketError?: (message: string) => void
  /** When set, clicking anywhere on the map reports the coordinates (e.g. to pick a destination). */
  onMapClick?: (point: Point) => void
  mapClickHint?: string
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

function ClickHandler({ onClick }: { onClick?: (point: Point) => void }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
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
  origin,
  destination,
  route,
  title = 'Carte — positions en temps réel',
  onSocketError,
  onMapClick,
  mapClickHint = 'Cliquez sur la carte pour choisir la destination',
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
    if (destination) pts.push(destination)
    if (pts.length === 0 && myPosition) pts.push(myPosition)
    return pts
  }, [origin, destination, myPosition])

  const mapBody = (
    <div className="relative z-0 isolate rounded-2xl overflow-hidden" style={{ height }}>
      {onMapClick && (
        <div className="absolute z-[400] top-3 left-1/2 -translate-x-1/2 bg-stone-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-floating pointer-events-none">
          {mapClickHint}
        </div>
      )}
      <MapContainer
        center={[myPosition?.lat ?? 14.7, myPosition?.lng ?? -17.45]}
        zoom={13}
        style={{ height: '100%', width: '100%', cursor: onMapClick ? 'crosshair' : undefined }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FitBounds points={fitPoints} />
        <ClickHandler onClick={onMapClick} />

        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#f2590e', weight: 5, opacity: 0.85 }} />}

        {myPosition && (
          <Marker position={[myPosition.lat, myPosition.lng]} icon={meIcon}>
            <Popup>Vous êtes ici</Popup>
          </Marker>
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={pinIcon('#1f9d65', 'A')}>
            <Popup>Départ</Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={pinIcon('#f2590e', 'B')}>
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
