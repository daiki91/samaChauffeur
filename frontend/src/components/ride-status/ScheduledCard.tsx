import { CalendarClock, Check } from 'lucide-react'
import Button from '../ui/Button'
import type { ActiveTrip } from './types'

type Props = {
  activeTrip: ActiveTrip
  onCancel: () => void
  cancelling: boolean
}

// Course programmée: booked for later, not yet visible to drivers.
export default function ScheduledCard({ activeTrip, onCancel, cancelling }: Props) {
  const when = activeTrip.scheduled_at
    ? new Date(activeTrip.scheduled_at).toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div key="scheduled" className="animate-fade-in-up">
      <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
        <CalendarClock size={18} className="text-brand-600" />
        Course programmée
      </h2>
      <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-4 mb-4 animate-pop">
        <div className="font-semibold text-stone-800 capitalize">{when}</div>
        <div className="mt-1 text-sm text-stone-600">
          {activeTrip.origin.split(',')[0]} → {activeTrip.destination.split(',')[0]}
        </div>
        {!!activeTrip.deposit_amount && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-white/60 rounded-full px-2.5 py-1">
            <Check size={12} /> Acompte réglé : {activeTrip.deposit_amount.toLocaleString('fr-FR')} XOF
          </div>
        )}
        <p className="mt-2 text-xs text-stone-500">Un chauffeur sera recherché automatiquement à l'approche de l'heure prévue.</p>
      </div>
      <Button variant="danger" fullWidth onClick={onCancel} loading={cancelling}>
        Annuler la réservation
      </Button>
    </div>
  )
}
