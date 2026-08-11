import { Navigation, Plus, X, CalendarClock, Route as RouteIcon, Clock3, Tag } from 'lucide-react'
import AddressAutocomplete from '../ui/AddressAutocomplete'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import type { AddressResult } from '../../lib/geocode'
import type { Route } from '../../lib/routing'
import { OptionPicker } from './shared'
import { VEHICLE_OPTIONS, PAYMENT_OPTIONS } from './types'
import type { Point } from './types'

type Props = {
  originText: string
  destinationText: string
  onOriginChange: (v: string) => void
  onOriginSelect: (r: AddressResult) => void
  onDestinationChange: (v: string) => void
  onDestinationSelect: (r: AddressResult) => void
  myPosition: Point | null
  originPoint: Point | null
  stops: { id: string; text: string; point: Point | null }[]
  onAddStop: () => void
  onRemoveStop: (id: string) => void
  onStopTextChange: (id: string, v: string) => void
  onStopSelect: (id: string, r: AddressResult) => void
  maxStops: number
  scheduleEnabled: boolean
  onScheduleToggle: (v: boolean) => void
  scheduledAtInput: string
  onScheduledAtChange: (v: string) => void
  pendingDiscount: { pct: number; label: string } | null
  routeLoading: boolean
  estimate: { price: number; distanceKm: number; priceMin?: number; priceMax?: number } | null
  route: Route | null
  submitting: boolean
  canRequest: boolean
  onSubmit: (e: React.FormEvent) => void
  vehicleType: string
  onVehicleTypeChange: (v: string) => void
  paymentMethod: string
  onPaymentMethodChange: (v: string) => void
}

// Idle: no active trip yet — either request one now, or schedule one for later.
export default function BookingForm({
  originText,
  destinationText,
  onOriginChange,
  onOriginSelect,
  onDestinationChange,
  onDestinationSelect,
  myPosition,
  originPoint,
  stops,
  onAddStop,
  onRemoveStop,
  onStopTextChange,
  onStopSelect,
  maxStops,
  scheduleEnabled,
  onScheduleToggle,
  scheduledAtInput,
  onScheduledAtChange,
  pendingDiscount,
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
}: Props) {
  const depositPreview = estimate ? Math.max(200, Math.round(estimate.price * 0.2)) : 0
  // datetime-local's min needs local time with no timezone offset, to the minute.
  const minScheduleValue = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const minScheduleDate = minScheduleValue.slice(0, 10)
  const scheduleDate = scheduledAtInput.slice(0, 10)
  const scheduleTime = scheduledAtInput.slice(11, 16)

  return (
    <div key="idle" className="animate-fade-in-up">
      <div className="grid grid-cols-2 gap-2 mb-4" role="group" aria-label="Type de réservation">
        <button type="button" aria-pressed={!scheduleEnabled} onClick={() => onScheduleToggle(false)} className={`flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${!scheduleEnabled ? 'bg-brand-500 text-white border-brand-500 shadow-card' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>
          <Navigation size={15} />
          Demander une course
        </button>
        <button type="button" aria-pressed={scheduleEnabled} onClick={() => onScheduleToggle(true)} className={`flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${scheduleEnabled ? 'bg-brand-500 text-white border-brand-500 shadow-card' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>
          <CalendarClock size={15} />
          Réserver plus tard
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <AddressAutocomplete label="Départ" placeholder="D'où partez-vous ?" value={originText} onChange={onOriginChange} onSelect={onOriginSelect} near={myPosition || undefined} currentPosition={myPosition} allowMyLocation />
        {stops.map((stop, i) => (
          <div key={stop.id} className="flex items-start gap-2">
            <div className="flex-1">
              <AddressAutocomplete label={`Arrêt ${i + 1}`} placeholder="Déposer quelqu'un ici ?" value={stop.text} onChange={(v) => onStopTextChange(stop.id, v)} onSelect={(r) => onStopSelect(stop.id, r)} near={originPoint || myPosition || undefined} />
            </div>
            <button type="button" onClick={() => onRemoveStop(stop.id)} className="mt-6 grid place-items-center w-8 h-8 rounded-lg bg-stone-100 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0" aria-label="Supprimer cet arrêt">
              <X size={14} />
            </button>
          </div>
        ))}

        <AddressAutocomplete label="Destination" placeholder="Où allez-vous ?" value={destinationText} onChange={onDestinationChange} onSelect={onDestinationSelect} near={originPoint || myPosition || undefined} />

        {stops.length < maxStops && (
          <button type="button" onClick={onAddStop} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 -mt-2">
            <Plus size={14} /> Ajouter un arrêt
          </button>
        )}

        <div>
          <div className="text-xs font-medium text-stone-500 mb-1.5">Type de véhicule</div>
          <OptionPicker options={VEHICLE_OPTIONS} value={vehicleType} onChange={onVehicleTypeChange} />
        </div>

        <div>
          <div className="text-xs font-medium text-stone-500 mb-1.5">Méthode de paiement</div>
          <OptionPicker options={PAYMENT_OPTIONS} value={paymentMethod} onChange={onPaymentMethodChange} />
        </div>

        {scheduleEnabled && (
          <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 animate-fade-in-up">
            <div className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <CalendarClock size={16} className="text-brand-600" />
              Pour quand ?
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={scheduleDate} min={minScheduleDate} onChange={(e) => onScheduledAtChange(`${e.target.value}T${scheduleTime || '08:00'}`)} className="flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300" />
              <input type="time" value={scheduleTime} onChange={(e) => onScheduledAtChange(`${scheduleDate || minScheduleDate}T${e.target.value}`)} className="flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300" />
            </div>
            {estimate && (
              <p className="mt-2 text-xs text-stone-500">
                Un acompte simulé de <span className="font-semibold text-stone-700">~{depositPreview.toLocaleString('fr-FR')} XOF</span> sera réglé pour confirmer la réservation.
              </p>
            )}
          </div>
        )}

        {pendingDiscount && (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-secondary-300 bg-secondary-50 px-4 py-3 animate-fade-in-up">
            <Tag size={16} className="text-secondary-600 shrink-0" />
            <span className="text-sm text-stone-700">
              Réduction <span className="font-semibold">-{pendingDiscount.pct}%</span> appliquée automatiquement à cette course
              <span className="block text-xs text-stone-400">{pendingDiscount.label}</span>
            </span>
          </div>
        )}

        {(routeLoading || estimate) && (
          <div className="animate-fade-in-up rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between">
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
                <span className="text-right">
                  {pendingDiscount && estimate ? (
                    <>
                      <span className="block text-xs text-stone-400 line-through">~{Math.round(estimate.price).toLocaleString('fr-FR')} XOF</span>
                      <span className="block font-bold text-secondary-600 flex items-center justify-end gap-1">
                        <Tag size={13} /> ~{Math.round(estimate.price * (1 - pendingDiscount.pct / 100)).toLocaleString('fr-FR')} XOF
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block font-bold text-brand-700">{estimate?.priceMin != null && estimate?.priceMax != null ? `~${estimate.priceMin.toLocaleString('fr-FR')} - ${estimate.priceMax.toLocaleString('fr-FR')} XOF` : `~${(estimate?.price ?? 0).toLocaleString('fr-FR')} XOF`}</span>
                      <span className="block text-[10px] text-brand-600/70">selon le trafic</span>
                    </>
                  )}
                </span>
              </>
            )}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" disabled={!canRequest} loading={submitting}>
          {scheduleEnabled ? "Réserver et payer l'acompte" : 'Demander une course'}
        </Button>
      </form>
    </div>
  )
}
