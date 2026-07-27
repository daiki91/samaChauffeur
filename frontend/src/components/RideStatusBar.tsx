import { useEffect, useRef, useState } from 'react'
import { Navigation, Car, Star, Users, Clock3, Route as RouteIcon, Check, MapPin, Phone, MessageCircle } from 'lucide-react'
import AddressAutocomplete from './ui/AddressAutocomplete'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import AnimatedNumber from './ui/AnimatedNumber'
import StarRating from './ui/StarRating'
import RatingCard from './RatingCard'
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
  dest_lat: number | null
  dest_lng: number | null
  created_at: string
  driver_detail: {
    id: number
    username?: string
    phone?: string
    vehicle: { type: string; plate_number: string; seats: number } | null
  } | null
  rating: { id: number; rating: number; comment: string | null; skipped: boolean; created_at: string } | null
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
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
            value === opt.value
              ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-card'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:scale-105'
          } disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed`}
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

/** Re-triggers a short "pop" animation whenever the watched value changes. */
function usePopOnChange<T>(value: T) {
  const [bump, setBump] = useState(0)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setBump((n) => n + 1)
    }
  }, [value])
  return bump
}

/** Polls nearby available chauffeurs and counts only those matching the given vehicle type. */
function useNearbyVehicleCount(point: Point | null, vehicleType: string | null, radiusKm = 5) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!point || !vehicleType) {
      setCount(null)
      return
    }
    let cancelled = false
    async function poll() {
      try {
        const r = await getAvailableChauffeurs({ lat: point!.lat, lng: point!.lng, radius: radiusKm })
        if (cancelled) return
        setCount(r.data.filter((d: any) => d.vehicle?.type === vehicleType).length)
      } catch {
        if (!cancelled) setCount(null)
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lng, vehicleType, radiusKm])

  return count
}

const PROGRESS_STEPS = ['Recherche', 'Chauffeur trouvé', 'Arrivée', 'En route'] as const

function TripProgress({ status }: { status: string }) {
  const stepIndex = status === 'STARTED' ? 3 : status === 'ARRIVED' ? 2 : status === 'ASSIGNED' || status === 'ACCEPTED' ? 1 : 0

  return (
    <div className="flex items-center mb-5">
      {PROGRESS_STEPS.map((label, i) => {
        const done = i < stepIndex
        const current = i === stepIndex
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
                {current && <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-40 animate-ping" />}
                <span
                  className={`relative inline-flex items-center justify-center rounded-full h-7 w-7 text-[11px] font-bold transition-colors duration-300 ${
                    done ? 'bg-secondary-500 text-white' : current ? 'bg-brand-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                  }`}
                >
                  {done ? <Check size={13} /> : i + 1}
                </span>
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${current ? 'text-brand-700' : done ? 'text-secondary-700' : 'text-stone-400 dark:text-stone-500'}`}>
                {label}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className="flex-1 h-1 mx-1.5 -mt-4 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-secondary-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: i < stepIndex ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type Props = {
  activeTrip: ActiveTrip | null
  completedTrip: ActiveTrip | null
  completedPaymentStatus: string | null
  onPayCompleted: (trip: ActiveTrip) => void
  onRateTrip: (trip: ActiveTrip, rating: number, comment?: string) => void
  onSkipRating: (trip: ActiveTrip) => void
  ratingSubmitting: boolean
  driverEtaMin: number | null

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
  onRateTrip,
  onSkipRating,
  ratingSubmitting,
  driverEtaMin,
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

  // Vehicle availability is intentionally not shown before the passenger has actually booked —
  // a low/zero count at that stage scares people off. Once they've committed (waiting for a
  // driver), showing the real count near their origin + vehicle type is useful reassurance.
  const waitPoint = waiting && activeTrip?.origin_lat != null && activeTrip?.origin_lng != null
    ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng }
    : null
  const waitNearby = useNearbyVehicleCount(waitPoint, waiting ? activeTrip?.vehicle_type ?? null : null)
  const nearbyBump = usePopOnChange(waitNearby)

  // ---------- Completed: pay first, then rate ----------
  if (!activeTrip && completedTrip) {
    const isPending = completedPaymentStatus === 'PENDING'
    const isFailed = completedPaymentStatus === 'FAILED'
    const isPaid = completedPaymentStatus === 'COMPLETED'
    return (
      <div key="completed" className="animate-fade-in-up">
        <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" />
          Course terminée
        </h2>
        <div className="rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 px-4 py-4 mb-4">
          <div className="text-sm text-green-700 dark:text-green-400 font-medium">Merci ! Votre course est terminée.</div>
          <div className="text-xs text-green-600 dark:text-green-500 mt-1">
            {completedTrip.origin.split(",").slice(0,1).join("")} → {completedTrip.destination.split(",").slice(0,1).join("")}
          </div>
          {completedTrip.price != null && (
            <div className="text-sm font-bold text-green-800 dark:text-green-300 mt-2">
              — <AnimatedNumber value={completedTrip.price} format={(n) => n.toLocaleString('fr-FR')} /> XOF
            </div>
          )}
        </div>

        {!isPaid && (
          <>
            {isPending && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 px-4 py-3 mb-3 text-sm text-amber-700 dark:text-amber-400 text-center">
                Paiement envoyé — en attente de validation par le chauffeur…
              </div>
            )}
            {isFailed && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 mb-3 text-sm text-red-700 dark:text-red-400 text-center">
                Le paiement précédent a échoué. Vous pouvez réessayer.
              </div>
            )}
            <Button fullWidth size="lg" disabled={isPending} onClick={() => onPayCompleted(completedTrip)}>
              {isPending ? 'Paiement en attente…' : 'Payer cette course'}
            </Button>
          </>
        )}

        {isPaid && (
          <>
            <div className="rounded-xl bg-secondary-50 dark:bg-secondary-500/10 border border-secondary-100 dark:border-secondary-500/20 px-4 py-3 mb-4 flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-400 font-medium">
              <Check size={16} className="shrink-0" />
              Paiement confirmé par le chauffeur
            </div>
            {!completedTrip.rating ? (
              <RatingCard
                driverName={completedTrip.driver_detail?.username}
                onRate={(rating, comment) => onRateTrip(completedTrip, rating, comment)}
                onSkip={() => onSkipRating(completedTrip)}
                submitting={ratingSubmitting}
              />
            ) : (
              !completedTrip.rating.skipped && (
                <div className="rounded-xl bg-accent-300/10 dark:bg-accent-400/10 border border-accent-300/30 dark:border-accent-400/20 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-stone-600 dark:text-stone-300">Votre note</span>
                  <StarRating value={completedTrip.rating.rating} readOnly size={16} />
                </div>
              )
            )}
          </>
        )}
      </div>
    )
  }

  // ---------- Idle: current booking form ----------
  if (!activeTrip) {
    return (
      <div key="idle" className="animate-fade-in-up">
        <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
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
          <p className="-mt-2 text-xs text-stone-400 dark:text-stone-500">Astuce : vous pouvez aussi cliquer directement sur la carte pour placer la destination.</p>

          <div>
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Type de véhicule</div>
            <OptionPicker options={VEHICLE_OPTIONS} value={vehicleType} onChange={onVehicleTypeChange} />
          </div>

          <div>
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Méthode de paiement</div>
            <OptionPicker options={PAYMENT_OPTIONS} value={paymentMethod} onChange={onPaymentMethodChange} />
          </div>

          {(routeLoading || estimate) && (
            <div className="animate-fade-in-up rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 px-4 py-3 flex items-center justify-between">
              {routeLoading ? (
                <span className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-400">
                  <Spinner size={16} /> Calcul de l'itinéraire...
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-4 text-sm text-brand-800 dark:text-brand-300">
                    <span className="flex items-center gap-1.5">
                      <RouteIcon size={15} /> {estimate?.distanceKm.toFixed(1)} km
                    </span>
                    {route && (
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={15} /> {Math.round(route.durationMin)} min
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-brand-700 dark:text-brand-400">
                    ~<AnimatedNumber value={estimate?.price ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
                  </span>
                </>
              )}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={!canRequest} loading={submitting}>
            Demander une course
          </Button>
        </form>
      </div>
    )
  }

  // ---------- Waiting: no driver yet ----------
  if (waiting) {
    return (
      <div key="waiting" className="animate-fade-in-up">
        <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" />
          Recherche d'un chauffeur
        </h2>

        <TripProgress status={activeTrip.status} />

        <div className="flex flex-col items-center py-4">
          <div className="relative flex items-center justify-center w-14 h-14 mb-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-30 animate-ping" style={{ animationDuration: '1.8s' }} />
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-20 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.5s' }} />
            <span className="relative inline-flex items-center justify-center rounded-full h-11 w-11 bg-brand-500 text-white">
              <Car size={20} />
            </span>
          </div>
          <div className="text-sm text-stone-500 dark:text-stone-400">En attente d'un chauffeur disponible…</div>
          <div className="mt-1 text-2xl font-bold text-stone-800 dark:text-stone-100 tabular-nums">{formatElapsed(elapsed)}</div>
        </div>

        <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 px-4 py-3 flex items-center justify-between mb-4">
          <span className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
            <Users size={15} />
            {VEHICLE_LABELS[activeTrip.vehicle_type]} à proximité
          </span>
          <span key={nearbyBump} className="font-semibold text-stone-800 dark:text-stone-100 animate-pop">{waitNearby ?? '—'}</span>
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Changer de type de véhicule</div>
          <OptionPicker options={VEHICLE_OPTIONS} value={activeTrip.vehicle_type} onChange={onChangeActiveVehicleType} disabled={changingVehicleType} />
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Méthode de paiement</div>
          <OptionPicker options={PAYMENT_OPTIONS} value={activeTrip.payment_method} onChange={onChangeActivePaymentMethod} disabled={changingPaymentMethod} />
        </div>

        {activeTrip.price != null && (
          <div className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            Estimation :{' '}
            <span className="font-semibold text-stone-700 dark:text-stone-200">
              ~<AnimatedNumber value={activeTrip.price} format={(n) => n.toLocaleString('fr-FR')} /> XOF
            </span>
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
    <div key="driver-found" className="animate-fade-in-up">
      <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
        <Navigation size={18} className="text-brand-600" />
        {status === 'ARRIVED' ? 'Votre chauffeur est arrivé' : 'Chauffeur trouvé'}
      </h2>

      <TripProgress status={status!} />

      {status === 'ARRIVED' && (
        <div className="rounded-xl bg-accent-300/15 dark:bg-accent-400/10 border border-accent-300/40 dark:border-accent-400/20 px-4 py-3 mb-4 flex items-center gap-2.5 animate-pop">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-accent-400 text-white shrink-0">
            <MapPin size={16} />
          </span>
          <div className="text-sm">
            <div className="font-semibold text-stone-800 dark:text-stone-100">Votre chauffeur vous attend</div>
            <div className="text-stone-500 dark:text-stone-400 text-xs">Rendez-vous au point de départ indiqué.</div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-secondary-50 dark:bg-secondary-500/10 border border-secondary-100 dark:border-secondary-500/20 px-4 py-4 mb-4 animate-pop">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-stone-800 dark:text-stone-100">{driver?.username || driver?.phone || 'Chauffeur en route'}</div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-full px-2 py-1">
            <Star size={12} className="fill-amber-500 text-amber-500" /> Nouveau chauffeur
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <Car size={15} />
          {vehicleLabel}
          {driver?.vehicle?.plate_number && <span className="text-stone-400 dark:text-stone-500">· {driver.vehicle.plate_number}</span>}
        </div>
        {driver?.phone && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`tel:${driver.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary-500 text-white text-sm font-medium py-2 hover:bg-secondary-600 active:scale-[0.97] transition-all"
            >
              <Phone size={14} /> Appeler
            </a>
            <a
              href={`sms:${driver.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-secondary-200 dark:border-secondary-500/30 text-secondary-700 dark:text-secondary-300 text-sm font-medium py-2 hover:bg-secondary-50 dark:hover:bg-secondary-500/10 active:scale-[0.97] transition-all"
            >
              <MessageCircle size={14} /> Message
            </a>
          </div>
        )}
        {driverEtaMin != null && (
          <div className="mt-3 pt-3 border-t border-secondary-100 dark:border-secondary-500/20 flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-secondary-500/15 text-secondary-700 dark:text-secondary-300 shrink-0">
              <Clock3 size={14} />
            </span>
            <span className="text-sm text-stone-700 dark:text-stone-200">
              {status === 'STARTED' ? 'Arrivée à destination dans' : 'Arrivée du chauffeur dans'}{' '}
              <span className="font-bold">~{Math.max(1, Math.round(driverEtaMin))} min</span>
            </span>
          </div>
        )}
      </div>

      {activeTrip!.price != null && (
        <div className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          Prix estimé :{' '}
          <span className="font-semibold text-stone-700 dark:text-stone-200">
            ~<AnimatedNumber value={activeTrip!.price} format={(n) => n.toLocaleString('fr-FR')} /> XOF
          </span>
        </div>
      )}

      <div className="mb-4">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Méthode de paiement</div>
        <OptionPicker options={PAYMENT_OPTIONS} value={activeTrip!.payment_method} onChange={onChangeActivePaymentMethod} disabled={changingPaymentMethod} />
      </div>

      <Button variant="danger" fullWidth onClick={onCancel} loading={cancelling} disabled={status === 'STARTED'}>
        {status === 'STARTED' ? 'Course en cours' : 'Annuler la course'}
      </Button>
    </div>
  )
}
