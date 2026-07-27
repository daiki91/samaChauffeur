import { X, MapPin, Navigation, Car, Wallet, Clock3, Star, Printer, Receipt } from 'lucide-react'
import Button from './ui/Button'
import Badge from './ui/Badge'
import StarRating from './ui/StarRating'
import RatingCard from './RatingCard'
import type { ActiveTrip } from './RideStatusBar'

const VEHICLE_LABELS: Record<string, string> = {
  CAR: 'Voiture',
  SEDAN: 'Berline',
  SUV: '4x4',
  MINIBUS: 'Minibus',
  BUS: 'Bus rapide',
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE: 'Orange Money',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Trip = ActiveTrip & { started_at: string | null; ended_at: string | null }

type Props = {
  trip: Trip | null
  onClose: () => void
  onRate: (trip: Trip, rating: number, comment?: string) => void
  onSkipRating: (trip: Trip) => void
  ratingSubmitting: boolean
}

export default function TripDetailModal({ trip, onClose, onRate, onSkipRating, ratingSubmitting }: Props) {
  if (!trip) return null

  const canRate = trip.status === 'COMPLETED' && !trip.rating
  const perKm = trip.price != null && trip.distance_km ? trip.price / trip.distance_km : null

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-4">
      <div id="print-receipt" className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl shadow-floating w-full max-w-md p-6 relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="print-hide">
          <button onClick={onClose} className="absolute right-4 top-4 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="hidden print:flex items-center gap-2 mb-4">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-warm-gradient text-white">
            <Receipt size={16} />
          </span>
          <span className="font-bold text-stone-900">samaChauffeur — Reçu de course</span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Badge status={trip.status} />
          <span className="text-xs text-stone-400 dark:text-stone-500">{formatDateTime(trip.created_at)}</span>
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-secondary-50 dark:bg-secondary-500/10 text-secondary-600 dark:text-secondary-400 shrink-0 mt-0.5">
              <MapPin size={13} />
            </span>
            <div className="text-sm text-stone-800 dark:text-stone-100 leading-snug">{trip.origin}</div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5">
              <Navigation size={13} />
            </span>
            <div className="text-sm text-stone-800 dark:text-stone-100 leading-snug">{trip.destination}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 px-3.5 py-3 flex items-center gap-2">
            <Car size={14} className="text-stone-400 dark:text-stone-500 shrink-0" />
            <div className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{VEHICLE_LABELS[trip.vehicle_type] || trip.vehicle_type}</div>
          </div>
          <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 px-3.5 py-3 flex items-center gap-2">
            <Wallet size={14} className="text-stone-400 dark:text-stone-500 shrink-0" />
            <div className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{PAYMENT_LABELS[trip.payment_method] || trip.payment_method}</div>
          </div>
        </div>

        {/* Receipt breakdown */}
        <div className="mt-4 rounded-xl border border-stone-100 dark:border-stone-800 px-4 py-3.5">
          <div className="text-[11px] text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Receipt size={12} /> Détail du prix
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
              <span>Distance parcourue</span>
              <span>{trip.distance_km != null ? `${Number(trip.distance_km).toFixed(1)} km` : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
              <span>Tarif au kilomètre</span>
              <span>{perKm != null ? `${Math.round(perKm).toLocaleString('fr-FR')} XOF/km` : '—'}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <span className="font-semibold text-stone-800 dark:text-stone-100">Total</span>
            <span className="font-bold text-lg text-stone-900 dark:text-stone-50">
              {trip.price != null ? `${trip.price.toLocaleString('fr-FR')} XOF` : '—'}
            </span>
          </div>
        </div>

        {trip.driver_detail && (
          <div className="mt-4 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 border border-secondary-100 dark:border-secondary-500/20 px-4 py-3">
            <div className="text-[11px] text-secondary-600 dark:text-secondary-400 uppercase tracking-wide mb-1">Chauffeur</div>
            <div className="text-sm font-semibold text-stone-800 dark:text-stone-100">{trip.driver_detail.username || trip.driver_detail.phone}</div>
            {trip.driver_detail.vehicle && (
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {VEHICLE_LABELS[trip.driver_detail.vehicle.type] || trip.driver_detail.vehicle.type} · {trip.driver_detail.vehicle.plate_number}
              </div>
            )}
          </div>
        )}

        {trip.started_at && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
            <Clock3 size={13} />
            Démarrée à {new Date(trip.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {trip.ended_at && <> · terminée à {new Date(trip.ended_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>}
          </div>
        )}

        {canRate && (
          <div className="print-hide mt-5">
            <RatingCard
              driverName={trip.driver_detail?.username}
              onRate={(rating, comment) => onRate(trip, rating, comment)}
              onSkip={() => onSkipRating(trip)}
              submitting={ratingSubmitting}
            />
          </div>
        )}

        {trip.rating && !trip.rating.skipped && (
          <div className="mt-5 rounded-xl bg-accent-300/10 dark:bg-accent-400/10 border border-accent-300/30 dark:border-accent-400/20 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <Star size={14} className="text-accent-500" fill="currentColor" />
                Votre note
              </span>
              <StarRating value={trip.rating.rating} readOnly size={15} />
            </div>
            {trip.rating.comment && <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 italic">"{trip.rating.comment}"</p>}
          </div>
        )}

        <div className="print-hide flex gap-2 mt-5">
          {trip.price != null && (
            <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>
              Reçu
            </Button>
          )}
          <Button fullWidth variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}
