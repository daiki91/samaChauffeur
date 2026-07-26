import { useEffect, useState } from 'react'
import { Navigation, Car, Star, Users, Clock3, Route as RouteIcon } from 'lucide-react'
import AddressAutocomplete from './ui/AddressAutocomplete'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import { getAvailableChauffeurs } from '../lib/api'
import type { Route } from '../lib/routing'
import type { AddressResult } from '../lib/geocode'

type Point = { lat: number; lng: number }

export type ActiveTrip = {
  id: number
  status: string
  vehicle_type: string
  payment_method: string
  price: number | null
  distance_km: number | null
  origin: string
  origin_lat: number | null
  origin_lng: number | null
  destination: string
  created_at: string
  driver_detail: {
    id: number
    username?: string
    phone?: string
    vehicle: { type: string; plate_number: string; seats: number } | null
  } | null
}

export const VEHICLE_OPTIONS = [
  { value: 'CAR', label: 'Voiture' },
  { value: 'SEDAN', label: 'Berline' },
  { value: 'SUV', label: '4x4' },
  { value: 'MINIBUS', label: 'Minibus' },
  { value: 'BUS', label: 'Bus rapide' },
]

const VEHICLE_LABELS: Record<string, string> = Object.fromEntries(VEHICLE_OPTIONS.map((o) => [o.value, o.label]))

export const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'ORANGE', label: 'Orange Money' },
]

type Option = { value: string; label: string }

function OptionPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Option[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            value === opt.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function useElapsedSeconds(since?: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!since) return
    const start = new Date(since).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [since])
  return elapsed
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type Props = {
  activeTrip: ActiveTrip | null
  completedTrip: ActiveTrip | null
  completedPaymentStatus: string | null
  onPayCompleted: (trip: ActiveTrip) => void

  // idle booking form (state owned by the parent dashboard, unchanged)
  originText: string
  destinationText: string
  onOriginChange: (v: string) => void
  onOriginSelect: (r: AddressResult) => void
  onDestinationChange: (v: string) => void
  onDestinationSelect: (r: AddressResult) => void
  myPosition: Point | null
  originPoint: Point | null
  routeLoading: boolean
  estimate: { price: number; distanceKm: number } | null
  route: Route | null
  submitting: boolean
  canRequest: boolean
  onSubmit: (e: React.FormEvent) => void
  vehicleType: string
  onVehicleTypeChange: (v: string) => void
  paymentMethod: string
  onPaymentMethodChange: (v: string) => void

  // active trip actions
  onCancel: () => void
  cancelling: boolean
  onChangeActiveVehicleType: (v: string) => void
  changingVehicleType: boolean
  onChangeActivePaymentMethod: (v: string) => void
  changingPaymentMethod: boolean
}

export default function RideStatusBar({
  activeTrip,
  completedTrip,
  completedPaymentStatus,
  onPayCompleted,
  originText,
  destinationText,
  onOriginChange,
  onOriginSelect,
  onDestinationChange,
  onDestinationSelect,
  myPosition,
  originPoint,
  routeLoading,
  estimate,
  route,
  submitting,
  canRequest,
  onSubmit,
  vehicleType,
  onVehicleTypeChange,
  paymentMethod,
  onPaymentMethodChange,
  onCancel,
  cancelling,
  onChangeActiveVehicleType,
  changingVehicleType,
  onChangeActivePaymentMethod,
  changingPaymentMethod,
}: Props) {
  const status = activeTrip?.status
  const waiting = !!activeTrip && status === 'REQUESTED'

  const elapsed = useElapsedSeconds(waiting ? activeTrip?.created_at : undefined)
  const [nearbyCount, setNearbyCount] = useState<number | null>(null)

  // Use the trip's own origin (not the form's originPoint, which the parent resets right
  // after submission) so the count keeps polling correctly throughout the wait.
  const waitOriginLat = waiting ? activeTrip?.origin_lat : null
  const waitOriginLng = waiting ? activeTrip?.origin_lng : null

  useEffect(() => {
    if (!waiting || waitOriginLat == null || waitOriginLng == null) {
      setNearbyCount(null)
      return
    }
    let cancelled = false
    async function poll() {
      try {
        const r = await getAvailableChauffeurs({ lat: waitOriginLat!, lng: waitOriginLng!, radius: 5 })
        if (!cancelled) setNearbyCount(r.data.length)
      } catch {
        if (!cancelled) setNearbyCount(null)
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [waiting, waitOriginLat, waitOriginLng])

  // ---------- Completed: show payment button ----------
  if (!activeTrip && completedTrip) {
    const priceLabel = completedTrip.price != null ? `— ${completedTrip.price.toLocaleString('fr-FR')} XOF` : ''
    const isPending = completedPaymentStatus === 'PENDING'
    const isFailed = completedPaymentStatus === 'FAILED'
    return (
      <div>
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" />
          Course terminée
        </h2>
        <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4 mb-4">
          <div className="text-sm text-green-700 font-medium">Merci ! Votre course est terminée.</div>
          <div className="text-xs text-green-600 mt-1">
            {completedTrip.origin.split(",").slice(0,1).join("")} → {completedTrip.destination.split(",").slice(0,1).join("")}
          </div>
          {completedTrip.price != null && (
            <div className="text-sm font-bold text-green-800 mt-2">{priceLabel}</div>
          )}
        </div>
        {isPending && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 mb-3 text-sm text-amber-700 text-center">
            Paiement envoyé — en attente de validation par le chauffeur…
          </div>
        )}
        {isFailed && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-3 text-sm text-red-700 text-center">
            Le paiement précédent a échoué. Vous pouvez réessayer.
          </div>
        )}
        <Button fullWidth size="lg" disabled={isPending} onClick={() => onPayCompleted(completedTrip)}>
          {isPending ? 'Paiement en attente…' : 'Payer cette course'}
        </Button>
      </div>
    )
  }

  // ---------- Idle: current booking form ----------
  if (!activeTrip) {
    return (
      <>
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" />
          Demander une course
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <AddressAutocomplete
            label="Départ"
            placeholder="D'où partez-vous ?"
            value={originText}
            onChange={onOriginChange}
            onSelect={onOriginSelect}
            near={myPosition || undefined}
            currentPosition={myPosition}
            allowMyLocation
          />
          <AddressAutocomplete
            label="Destination"
            placeholder="Où allez-vous ?"
            value={destinationText}
            onChange={onDestinationChange}
            onSelect={onDestinationSelect}
            near={originPoint || myPosition || undefined}
          />
          <p className="-mt-2 text-xs text-stone-400">Astuce : vous pouvez aussi cliquer directement sur la carte pour placer la destination.</p>

          <div>
            <div className="text-xs font-medium text-stone-500 mb-1.5">Type de véhicule</div>
            <OptionPicker options={VEHICLE_OPTIONS} value={vehicleType} onChange={onVehicleTypeChange} />
          </div>

          <div>
            <div className="text-xs font-medium text-stone-500 mb-1.5">Méthode de paiement</div>
            <OptionPicker options={PAYMENT_OPTIONS} value={paymentMethod} onChange={onPaymentMethodChange} />
          </div>

          {(routeLoading || estimate) && (
            <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between">
              {routeLoading ? (
                <span className="flex items-center gap-2 text-sm text-brand-700">
                  <Spinner size={16} /> Calcul de l'itinéraire...
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-4 text-sm text-brand-800">
                    <span className="flex items-center gap-1.5">
                      <RouteIcon size={15} /> {estimate?.distanceKm.toFixed(1)} km
                    </span>
                    {route && (
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={15} /> {Math.round(route.durationMin)} min
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-brand-700">~{estimate?.price.toLocaleString('fr-FR')} XOF</span>
                </>
              )}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={!canRequest} loading={submitting}>
            Demander une course
          </Button>
        </form>
      </>
    )
  }

  // ---------- Waiting: no driver yet ----------
  if (waiting) {
    return (
      <div>
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" />
          Recherche d'un chauffeur
        </h2>

        <div className="flex flex-col items-center py-4">
          <div className="relative flex items-center justify-center w-14 h-14 mb-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-40 animate-ping" />
            <span className="relative inline-flex items-center justify-center rounded-full h-11 w-11 bg-brand-500 text-white">
              <Car size={20} />
            </span>
          </div>
          <div className="text-sm text-stone-500">En attente d'un chauffeur disponible…</div>
          <div className="mt-1 text-2xl font-bold text-stone-800 tabular-nums">{formatElapsed(elapsed)}</div>
        </div>

        <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 flex items-center justify-between mb-4">
          <span className="flex items-center gap-1.5 text-sm text-stone-600">
            <Users size={15} />
            Véhicules à proximité
          </span>
          <span className="font-semibold text-stone-800">{nearbyCount ?? '—'}</span>
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-stone-500 mb-1.5">Changer de type de véhicule</div>
          <OptionPicker options={VEHICLE_OPTIONS} value={activeTrip.vehicle_type} onChange={onChangeActiveVehicleType} disabled={changingVehicleType} />
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-stone-500 mb-1.5">Méthode de paiement</div>
          <OptionPicker options={PAYMENT_OPTIONS} value={activeTrip.payment_method} onChange={onChangeActivePaymentMethod} disabled={changingPaymentMethod} />
        </div>

        {activeTrip.price != null && (
          <div className="text-sm text-stone-500 mb-4">
            Estimation : <span className="font-semibold text-stone-700">~{activeTrip.price.toLocaleString('fr-FR')} XOF</span>
          </div>
        )}

        <Button variant="danger" fullWidth onClick={onCancel} loading={cancelling}>
          Annuler la course
        </Button>
      </div>
    )
  }

  // ---------- Driver found ----------
  const driver = activeTrip!.driver_detail
  const vehicleLabel = driver?.vehicle ? VEHICLE_LABELS[driver.vehicle.type] || driver.vehicle.type : VEHICLE_LABELS[activeTrip!.vehicle_type]

  return (
    <div>
      <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
        <Navigation size={18} className="text-brand-600" />
        Chauffeur trouvé
      </h2>

      <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-stone-800">{driver?.username || driver?.phone || 'Chauffeur en route'}</div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-1">
            <Star size={12} className="fill-amber-500 text-amber-500" /> Nouveau chauffeur
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <Car size={15} />
          {vehicleLabel}
          {driver?.vehicle?.plate_number && <span className="text-stone-400">· {driver.vehicle.plate_number}</span>}
        </div>
        {driver?.phone && <div className="mt-1 text-xs text-stone-400">{driver.phone}</div>}
      </div>

      {activeTrip!.price != null && (
        <div className="text-sm text-stone-500 mb-4">
          Prix estimé : <span className="font-semibold text-stone-700">~{activeTrip!.price.toLocaleString('fr-FR')} XOF</span>
        </div>
      )}

      <div className="mb-4">
        <div className="text-xs font-medium text-stone-500 mb-1.5">Méthode de paiement</div>
        <OptionPicker options={PAYMENT_OPTIONS} value={activeTrip!.payment_method} onChange={onChangeActivePaymentMethod} disabled={changingPaymentMethod} />
      </div>

      <Button variant="danger" fullWidth onClick={onCancel} loading={cancelling} disabled={status === 'STARTED'}>
        {status === 'STARTED' ? 'Course en cours' : 'Annuler la course'}
      </Button>
    </div>
  )
}
