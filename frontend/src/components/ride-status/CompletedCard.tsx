import { Navigation, Check } from 'lucide-react'
import Button from '../ui/Button'
import AnimatedNumber from '../ui/AnimatedNumber'
import StarRating from '../ui/StarRating'
import RatingCard from '../RatingCard'
import type { ActiveTrip } from './types'

type Props = {
  completedTrip: ActiveTrip
  completedPaymentStatus: string | null
  onPayCompleted: (trip: ActiveTrip) => void
  onRateTrip: (trip: ActiveTrip, rating: number, comment?: string) => void
  onSkipRating: (trip: ActiveTrip) => void
  ratingSubmitting: boolean
}

// Course terminée: pay first, then rate.
export default function CompletedCard({ completedTrip, completedPaymentStatus, onPayCompleted, onRateTrip, onSkipRating, ratingSubmitting }: Props) {
  const isPending = completedPaymentStatus === 'PENDING'
  const isFailed = completedPaymentStatus === 'FAILED'
  const isPaid = completedPaymentStatus === 'COMPLETED'

  return (
    <div key="completed" className="animate-fade-in-up">
      <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
        <Navigation size={18} className="text-brand-600" />
        Course terminée
      </h2>
      <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-4 mb-4">
        <div className="text-sm text-secondary-700 font-medium">Merci ! Votre course est terminée.</div>
        <div className="text-xs text-secondary-600 mt-1">
          {completedTrip.origin.split(',').slice(0, 1).join('')} → {completedTrip.destination.split(',').slice(0, 1).join('')}
        </div>
        {completedTrip.price != null && (
          <div className="text-sm font-bold text-secondary-800 mt-2">
            — <AnimatedNumber value={completedTrip.price} format={(n) => n.toLocaleString('fr-FR')} /> XOF
          </div>
        )}
      </div>

      {!isPaid && (
        <>
          {isPending && <div className="rounded-xl bg-accent-300/15 border border-accent-300/40 px-4 py-3 mb-3 text-sm text-stone-700 text-center">Paiement envoyé — en attente de validation par le chauffeur…</div>}
          {isFailed && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-3 text-sm text-red-700 text-center">Le paiement précédent a échoué. Vous pouvez réessayer.</div>}
          <Button fullWidth size="lg" disabled={isPending} onClick={() => onPayCompleted(completedTrip)}>
            {isPending ? 'Paiement en attente…' : 'Payer cette course'}
          </Button>
        </>
      )}

      {isPaid && (
        <>
          <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-3 mb-4 flex items-center gap-2 text-sm text-secondary-700 font-medium">
            <Check size={16} className="shrink-0" />
            Paiement confirmé par le chauffeur
          </div>
          {!completedTrip.rating ? (
            <RatingCard driverName={completedTrip.driver_detail?.username} onRate={(rating, comment) => onRateTrip(completedTrip, rating, comment)} onSkip={() => onSkipRating(completedTrip)} submitting={ratingSubmitting} />
          ) : (
            !completedTrip.rating.skipped && (
              <div className="rounded-xl bg-accent-300/10 border border-accent-300/30 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-stone-600">Votre note</span>
                <StarRating value={completedTrip.rating.rating} readOnly size={16} />
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
