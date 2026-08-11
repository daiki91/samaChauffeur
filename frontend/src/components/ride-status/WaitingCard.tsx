import { Navigation, Car, Users } from 'lucide-react'
import Button from '../ui/Button'
import AnimatedNumber from '../ui/AnimatedNumber'
import { OptionPicker, TripProgress, useElapsedSeconds, formatElapsed, usePopOnChange, useNearbyVehicleCount } from './shared'
import { VEHICLE_OPTIONS, PAYMENT_OPTIONS, VEHICLE_LABELS, type ActiveTrip } from './types'

type Props = {
  activeTrip: ActiveTrip
  onChangeActiveVehicleType: (v: string) => void
  changingVehicleType: boolean
  onChangeActivePaymentMethod: (v: string) => void
  changingPaymentMethod: boolean
  onCancel: () => void
  cancelling: boolean
}

// Recherche d'un chauffeur: trip requested, no driver assigned yet.
export default function WaitingCard({ activeTrip, onChangeActiveVehicleType, changingVehicleType, onChangeActivePaymentMethod, changingPaymentMethod, onCancel, cancelling }: Props) {
  const elapsed = useElapsedSeconds(activeTrip.created_at)

  // Vehicle availability is intentionally not shown before the passenger has actually booked —
  // a low/zero count at that stage scares people off. Once they've committed (waiting for a
  // driver), showing the real count near their origin + vehicle type is useful reassurance.
  const waitPoint = activeTrip.origin_lat != null && activeTrip.origin_lng != null ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng } : null
  const waitNearby = useNearbyVehicleCount(waitPoint, activeTrip.vehicle_type)
  const nearbyBump = usePopOnChange(waitNearby)

  return (
    <div key="waiting" className="animate-fade-in-up">
      <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
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
        <div className="text-sm text-stone-500">En attente d'un chauffeur disponible…</div>
        <div className="mt-1 text-2xl font-bold text-stone-800 tabular-nums">{formatElapsed(elapsed)}</div>
      </div>

      <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 flex items-center justify-between mb-4">
        <span className="flex items-center gap-1.5 text-sm text-stone-600">
          <Users size={15} />
          {VEHICLE_LABELS[activeTrip.vehicle_type]} à proximité
        </span>
        <span key={nearbyBump} className="font-semibold text-stone-800 animate-pop">
          {waitNearby ?? '—'}
        </span>
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
          Estimation :{' '}
          <span className="font-semibold text-stone-700">
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
