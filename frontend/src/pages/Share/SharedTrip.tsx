import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Car, MapPin, Navigation, ShieldAlert } from 'lucide-react'
import { getSharedTrip } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const pinIcon = (color: string, label: string) =>
  L.divIcon({
    className: '',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:9999px 9999px 9999px 0;transform:rotate(45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
 <span style="transform:rotate(-45deg);color:white;font-size:11px;font-weight:700;">${label}</span>
 </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })

const carDivIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:34px;height:34px;">
 <span class="animate-marker-pulse"style="position:absolute;inset:0;border-radius:9999px;background:#f2590e;"></span>
 <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:#f2590e;border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;">
 <svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="white"stroke-width="2.3"stroke-linecap="round"stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7"cy="17"r="2"/><path d="M9 17h6"/><circle cx="17"cy="17"r="2"/></svg>
 </div>
 </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const VEHICLE_LABELS: Record<string, string> = { CAR: 'Voiture', SEDAN: 'Berline', SUV: '4x4', MINIBUS: 'Minibus', BUS: 'Bus rapide' }

const ONGOING_STATUSES = ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED']

type SharedTripData = {
  status: string
  origin: string
  origin_lat: number | null
  origin_lng: number | null
  destination: string
  dest_lat: number | null
  dest_lng: number | null
  distance_km: number | null
  created_at: string
  driver: { username?: string; photo?: string | null; vehicle: { type: string; plate_number: string } | null; latitude: number | null; longitude: number | null } | null
}

export default function SharedTrip() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedTripData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const r = await getSharedTrip(token)
        if (cancelled) return
        setData(r.data)
        if (!ONGOING_STATUSES.includes(r.data.status) && r.data.status !== 'REQUESTED' && interval) {
          clearInterval(interval)
        }
      } catch {
        if (!cancelled) setNotFound(true)
      }
    }
    load()
    interval = setInterval(load, 8000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [token])

  if (notFound) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-center px-6">
        <div>
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-red-50 text-red-500 mx-auto mb-4">
            <ShieldAlert size={28} />
          </span>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Lien introuvable</h1>
          <p className="text-stone-500 max-w-sm">Ce lien de suivi n'existe pas ou n'est plus valide.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }

  const driverPos = data.driver?.latitude != null && data.driver?.longitude != null ? { lat: data.driver.latitude, lng: data.driver.longitude } : null
  const points: [number, number][] = []
  if (data.origin_lat != null && data.origin_lng != null) points.push([data.origin_lat, data.origin_lng])
  if (data.dest_lat != null && data.dest_lng != null) points.push([data.dest_lat, data.dest_lng])
  if (driverPos) points.push([driverPos.lat, driverPos.lng])
  const center: [number, number] = points[0] || [14.6928, -17.4467]

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Navigation size={20} className="text-brand-600" />
          Suivi de trajet
        </h1>
        <Badge status={data.status} />
      </div>

      <Card className="mb-4 !p-3" padded={false}>
        <div className="rounded-xl overflow-hidden" style={{ height: '40vh' }}>
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {data.origin_lat != null && data.origin_lng != null && <Marker position={[data.origin_lat, data.origin_lng]} icon={pinIcon('#1f9d65', 'A')} />}
            {data.dest_lat != null && data.dest_lng != null && <Marker position={[data.dest_lat, data.dest_lng]} icon={pinIcon('#f2590e', 'B')} />}
            {driverPos && <Marker position={[driverPos.lat, driverPos.lng]} icon={carDivIcon} />}
          </MapContainer>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-start gap-2 text-sm text-stone-700">
          <MapPin size={16} className="mt-0.5 text-secondary-600 shrink-0" />
          <div>
            <div>{data.origin}</div>
            <div className="text-stone-400">→ {data.destination}</div>
          </div>
        </div>
        {data.distance_km != null && <div className="mt-2 text-xs text-stone-400">{data.distance_km.toFixed(1)} km</div>}
      </Card>

      {data.driver && (
        <Card>
          <div className="flex items-center gap-3">
            {data.driver.photo ? <img src={data.driver.photo} alt={data.driver.username} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-card shrink-0" /> : <span className="grid place-items-center w-12 h-12 rounded-full bg-secondary-500 text-white font-bold uppercase shrink-0">{(data.driver.username || '?').slice(0, 2)}</span>}
            <div className="min-w-0">
              <div className="font-semibold text-stone-800 truncate">{data.driver.username || 'Chauffeur'}</div>
              {data.driver.vehicle && (
                <div className="flex items-center gap-1.5 text-sm text-stone-500">
                  <Car size={14} /> {VEHICLE_LABELS[data.driver.vehicle.type] || data.driver.vehicle.type} · {data.driver.vehicle.plate_number}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-stone-400">Suivi en direct via samaChauffeur — actualisé automatiquement.</p>
    </div>
  )
}
