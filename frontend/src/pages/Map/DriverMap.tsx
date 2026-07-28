import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
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

// Classic teardrop pin (lucide MapPin path) shared by origin/destination — same silhouette,
// different fill + inner glyph, so they read as a family while staying easy to tell apart.
const PIN_PATH = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'
const FLAG_PATH = 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'

const originIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));">
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="${PIN_PATH}" fill="#1f9d65" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="10" r="3.4" fill="white"/>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 29],
  })

const destinationIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));">
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="${PIN_PATH}" fill="#f2590e" stroke="white" stroke-width="1.5"/>
          <g transform="translate(7.6,5.6) scale(0.58)">
            <path d="${FLAG_PATH}" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="4" x2="4" y1="22" y2="15" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
          </g>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 29],
  })

// Smaller, rounder waypoint badges (as opposed to the teardrop origin/destination pins) so
// intermediate stops read as secondary to the two real endpoints.
const stopIcon = (n: number) =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="width:23px;height:23px;border-radius:9999px;background:#de9a1f;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;">
        ${n}
      </div>`,
    iconSize: [23, 23],
    iconAnchor: [11, 11],
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
    <div className="relative z-0 isolate rounded-2xl overflow-hidden" style={{ height }}>
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
