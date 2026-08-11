import { useState } from 'react'
import { Navigation, Car, Star, MapPin, Phone, MessageCircle, Route as RouteIcon, Clock3, Share2, ShieldAlert } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import AnimatedNumber from '../ui/AnimatedNumber'
import { getInitials } from '../../lib/format'
import { OptionPicker, TripProgress } from './shared'
import { PAYMENT_OPTIONS, VEHICLE_LABELS, type ActiveTrip } from './types'

type Props = {
  activeTrip: ActiveTrip
  driverEtaMin: number | null
  driverRating: { average: number | null; count: number } | null
  onChangeActivePaymentMethod: (v: string) => void
  changingPaymentMethod: boolean
  onShareTrip: () => void
  sharingTrip: boolean
  onCancel: () => void
  cancelling: boolean
  onSos: () => void
  sosSubmitting: boolean
}

// Chauffeur trouvé / en route / arrivé / course en cours — everything from ASSIGNED onward.
export default function DriverFoundCard({
  activeTrip,
  driverEtaMin,
  driverRating,
  onChangeActivePaymentMethod,
  changingPaymentMethod,
  onShareTrip,
  sharingTrip,
  onCancel,
  cancelling,
  onSos,
  sosSubmitting,
}: Props) {
  const [sosConfirming, setSosConfirming] = useState(false)
  const status = activeTrip.status
  const driver = activeTrip.driver_detail
  const vehicleLabel = driver?.vehicle ? VEHICLE_LABELS[driver.vehicle.type] || driver.vehicle.type : VEHICLE_LABELS[activeTrip.vehicle_type]

  return (
    <div key="driver-found" className="animate-fade-in-up">
      <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
        <Navigation size={18} className="text-brand-600" />
        {status === 'ARRIVED' ? 'Votre chauffeur est arrivé' : 'Chauffeur trouvé'}
      </h2>

      <TripProgress status={status} />

      {status === 'ARRIVED' && (
        <div className="rounded-xl bg-accent-300/15 border border-accent-300/40 px-4 py-3 mb-4 flex items-center gap-2.5 animate-pop">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-accent-400 text-white shrink-0">
            <MapPin size={16} />
          </span>
          <div className="text-sm">
            <div className="font-semibold text-stone-800">Votre chauffeur vous attend</div>
            <div className="text-stone-500 text-xs">Rendez-vous au point de départ indiqué.</div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-4 mb-4 animate-pop">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {driver?.photo ? (
              <img src={driver.photo} alt={driver.username || 'Chauffeur'} className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white shadow-card" />
            ) : (
              <span className="grid place-items-center w-10 h-10 rounded-full bg-secondary-500 text-white font-bold uppercase text-sm shrink-0">{getInitials(driver?.username || driver?.phone)}</span>
            )}
            <div className="font-semibold text-stone-800 truncate">{driver?.username || driver?.phone || 'Chauffeur en route'}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 bg-accent-300/15 rounded-full px-2 py-1 shrink-0">
            <Star size={12} className="fill-accent-500 text-accent-500" />
            {driverRating?.average != null ? `${driverRating.average.toFixed(1)} (${driverRating.count})` : 'Nouveau chauffeur'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <Car size={15} />
          {vehicleLabel}
          {driver?.vehicle?.plate_number && <span className="text-stone-400">· {driver.vehicle.plate_number}</span>}
        </div>
        {!!activeTrip.stops?.length && (
          <div className="mt-1.5 flex items-start gap-2 text-xs text-stone-500">
            <RouteIcon size={13} className="mt-0.5 shrink-0" />
            <span>Via {activeTrip.stops.map((s) => s.label.split(',')[0]).join(',')}</span>
          </div>
        )}
        {driver?.phone && (
          <div className="mt-3 flex items-center gap-2">
            <a href={`tel:${driver.phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary-500 text-white text-sm font-medium py-2 hover:bg-secondary-600 active:scale-[0.97] transition-all">
              <Phone size={14} /> Appeler
            </a>
            <a href={`sms:${driver.phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-secondary-200 text-secondary-700 text-sm font-medium py-2 hover:bg-secondary-50 active:scale-[0.97] transition-all">
              <MessageCircle size={14} /> Message
            </a>
          </div>
        )}
        {driverEtaMin != null && (
          <div className="mt-3 pt-3 border-t border-secondary-100 flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-secondary-500/15 text-secondary-700 shrink-0">
              <Clock3 size={14} />
            </span>
            <span className="text-sm text-stone-700">
              {status === 'STARTED' ? 'Arrivée à destination dans' : 'Arrivée du chauffeur dans'}{' '}
              <span className="font-bold">~{Math.max(1, Math.round(driverEtaMin))} min</span>
            </span>
          </div>
        )}
      </div>

      {activeTrip.price != null && (
        <div className="text-sm text-stone-500 mb-4">
          Prix estimé :{' '}
          <span className="font-semibold text-stone-700">
            ~<AnimatedNumber value={activeTrip.price} format={(n) => n.toLocaleString('fr-FR')} /> XOF
          </span>
        </div>
      )}

      <div className="mb-4">
        <div className="text-xs font-medium text-stone-500 mb-1.5">Méthode de paiement</div>
        <OptionPicker options={PAYMENT_OPTIONS} value={activeTrip.payment_method} onChange={onChangeActivePaymentMethod} disabled={changingPaymentMethod} />
      </div>

      <Button variant="outline" fullWidth icon={<Share2 size={15} />} onClick={onShareTrip} loading={sharingTrip} className="mb-2.5">
        Partager le trajet
      </Button>

      <Button variant="danger" fullWidth onClick={onCancel} loading={cancelling} disabled={status === 'STARTED'}>
        {status === 'STARTED' ? 'Course en cours' : 'Annuler la course'}
      </Button>

      <button type="button" onClick={() => setSosConfirming(true)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-stone-400 hover:text-red-500 transition-colors">
        <ShieldAlert size={13} /> Urgence / SOS
      </button>

      <Modal open={sosConfirming} onClose={() => setSosConfirming(false)} dismissible={!sosSubmitting} labelledBy="sos-confirm-title">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-red-50 text-red-600 mb-3">
          <ShieldAlert size={20} />
        </span>
        <h3 id="sos-confirm-title" className="text-lg font-semibold text-stone-900">
          Déclencher l'alerte SOS ?
        </h3>
        <p className="text-sm text-stone-500 mb-5">Notre équipe sera alertée immédiatement avec votre position, et l'appel d'urgence s'ouvrira sur votre téléphone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setSosConfirming(false)} disabled={sosSubmitting}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={sosSubmitting}
            onClick={() => {
              onSos()
              setSosConfirming(false)
            }}
          >
            Oui, envoyer l'alerte
          </Button>
        </div>
      </Modal>
    </div>
  )
}
