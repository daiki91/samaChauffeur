import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Car, MapPin, Navigation, ShieldAlert, WifiOff, RotateCw } from 'lucide-react'
import { getSharedTrip } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { originIcon, destinationIcon, carIcon } from '../../lib/mapIcons'
import { getInitials, VEHICLE_LABELS } from '../../lib/format'

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
  // 'not_found' (invalid/expired token, permanent — 404) is distinct from 'network' (transient
  // failure, worth retrying) — conflating the two used to tell someone whose driver has spotty
  // connectivity that their tracking link was simply invalid.
  const [errorKind, setErrorKind] = useState<'not_found' | 'network' | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const retry = useCallback(() => setRetryTick((t) => t + 1), [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const r = await getSharedTrip(token)
        if (cancelled) return
        setData(r.data)
        setErrorKind(null)
        if (!ONGOING_STATUSES.includes(r.data.status) && r.data.status !== 'REQUESTED' && interval) {
          clearInterval(interval)
        }
      } catch (err: any) {
        if (cancelled) return
        setErrorKind(err?.response?.status === 404 ? 'not_found' : 'network')
      }
    }
    load()
    interval = setInterval(load, 8000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [token, retryTick])

  if (errorKind === 'not_found') {
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

  if (errorKind === 'network' && !data) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-center px-6">
        <div className="flex flex-col items-center gap-3">
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-stone-100 text-stone-400 mx-auto mb-1">
            <WifiOff size={28} />
          </span>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Connexion impossible</h1>
          <p className="text-stone-500 max-w-sm mb-2">Impossible de charger le suivi pour le moment. Vérifiez votre connexion.</p>
          <Button variant="outline" icon={<RotateCw size={15} />} onClick={retry}>
            Réessayer
          </Button>
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
            {data.origin_lat != null && data.origin_lng != null && <Marker position={[data.origin_lat, data.origin_lng]} icon={originIcon()} />}
            {data.dest_lat != null && data.dest_lng != null && <Marker position={[data.dest_lat, data.dest_lng]} icon={destinationIcon()} />}
            {driverPos && <Marker position={[driverPos.lat, driverPos.lng]} icon={carIcon(data.driver?.vehicle?.type)} />}
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
            {data.driver.photo ? <img src={data.driver.photo} alt={data.driver.username} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-card shrink-0" /> : <span className="grid place-items-center w-12 h-12 rounded-full bg-secondary-500 text-white font-bold uppercase shrink-0">{getInitials(data.driver.username)}</span>}
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
