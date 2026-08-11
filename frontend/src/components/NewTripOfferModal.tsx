import { useEffect, useState } from 'react'
import { MapPin, Navigation, Wallet, Route as RouteIcon } from 'lucide-react'
import Button from './ui/Button'
import Modal from './ui/Modal'

const OFFER_SECONDS = 20

type Offer = { id: number; origin: string; destination: string; distance_km: number | null; price: number | null }

type Props = {
  offer: Offer | null
  onAccept: () => void
  onDecline: () => void
  accepting: boolean
}

export default function NewTripOfferModal({ offer, onAccept, onDecline, accepting }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS)

  // Countdown resets for every new offer id — a fresh request always gets the full window,
  // not whatever was left over from the previous one.
  useEffect(() => {
    if (!offer) return
    setSecondsLeft(OFFER_SECONDS)
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [offer?.id])

  useEffect(() => {
    if (offer && secondsLeft <= 0 && !accepting) onDecline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, offer?.id])

  if (!offer) return null

  const progressPct = Math.max(0, (secondsLeft / OFFER_SECONDS) * 100)

  return (
    <Modal open={!!offer} onClose={onDecline} dismissible={!accepting} bottomSheet maxWidth="max-w-sm" labelledBy="trip-offer-title" className="overflow-hidden">
      <div className="absolute top-0 left-0 h-1 bg-brand-500 transition-all duration-1000 ease-linear" style={{ width: `${progressPct}%` }} />

      <div className="flex items-center gap-2.5 mb-4">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-warm-gradient text-white shrink-0 animate-pulse-slow">
          <RouteIcon size={18} />
        </span>
        <div>
          <h3 id="trip-offer-title" className="text-lg font-bold text-stone-900">
            Nouvelle course !
          </h3>
          <p className="text-xs text-stone-400">{secondsLeft}s pour répondre</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        <div className="flex items-start gap-2.5">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-secondary-50 text-secondary-600 shrink-0 mt-0.5">
            <MapPin size={13} />
          </span>
          <div className="text-sm text-stone-800 leading-snug">{offer.origin}</div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-50 text-brand-600 shrink-0 mt-0.5">
            <Navigation size={13} />
          </span>
          <div className="text-sm text-stone-800 leading-snug">{offer.destination}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-stone-50 border border-stone-100 px-3.5 py-3 flex items-center gap-2">
          <RouteIcon size={14} className="text-stone-400 shrink-0" />
          <div className="text-sm font-medium text-stone-700">{offer.distance_km ? `${Number(offer.distance_km).toFixed(1)} km` : '—'}</div>
        </div>
        <div className="rounded-xl bg-stone-50 border border-stone-100 px-3.5 py-3 flex items-center gap-2">
          <Wallet size={14} className="text-stone-400 shrink-0" />
          <div className="text-sm font-medium text-stone-700">{offer.price ? `${offer.price.toLocaleString('fr-FR')} XOF` : 'Prix non estimé'}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button fullWidth variant="ghost" onClick={onDecline} disabled={accepting}>
          Ignorer
        </Button>
        <Button fullWidth size="lg" loading={accepting} onClick={onAccept}>
          Accepter
        </Button>
      </div>
    </Modal>
  )
}
