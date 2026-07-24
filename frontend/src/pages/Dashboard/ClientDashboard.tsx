import { useEffect, useMemo, useState } from 'react'
import DriverMap from '../Map/DriverMap'
import { getAvailableChauffeurs, getMyTrips, getTransactions, getPaymentsSummary, createTrip, makePayment, estimatePrice } from '../../lib/api'
import PaymentModal from '../../components/PaymentModal'
import { useToasts } from '../../components/Toasts'
import AddressAutocomplete from '../../components/ui/AddressAutocomplete'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { getRoute, type Route } from '../../lib/routing'
import { haversineKm } from '../../lib/geo'
import { reverseGeocode } from '../../lib/geocode'
import { useGeolocation } from '../../lib/useGeolocation'
import { Navigation, MapPinned, Wallet, Route as RouteIcon, Clock3 } from 'lucide-react'

type Point = { lat: number; lng: number }

export default function ClientDashboard() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [paymentsSummary, setPaymentsSummary] = useState<any | null>(null)
  const [modalTrip, setModalTrip] = useState<any | null>(null)
  const { addToast } = useToasts()
  const { position: myPosition } = useGeolocation()

  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [originPoint, setOriginPoint] = useState<Point | null>(null)
  const [destinationPoint, setDestinationPoint] = useState<Point | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [estimate, setEstimate] = useState<{ price: number; distanceKm: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableChauffeurs()
        setDrivers(r.data)
      } catch (e) {}
      try {
        const t = await getMyTrips()
        setTrips(t.data)
      } catch (e) {}
      try {
        const p = await getTransactions()
        setTransactions(p.data)
      } catch (e) {}
      try {
        const s = await getPaymentsSummary()
        setPaymentsSummary(s.data)
      } catch (e) {}
    }
    load()
  }, [])

  // Whenever both points are known, fetch the real road route + a live price estimate.
  useEffect(() => {
    let cancelled = false
    async function computeRoute() {
      if (!originPoint || !destinationPoint) {
        setRoute(null)
        setEstimate(null)
        return
      }
      setRouteLoading(true)
      const r = await getRoute(originPoint, destinationPoint)
      if (cancelled) return
      const distanceKm = r?.distanceKm ?? haversineKm(originPoint, destinationPoint)
      setRoute(r)
      setRouteLoading(false)
      try {
        const est = await estimatePrice({ distance_km: distanceKm, vehicle_type: 'CAR', mode: 'PRIVATE' })
        if (!cancelled) setEstimate({ price: est.data.price, distanceKm })
      } catch {
        if (!cancelled) setEstimate(null)
      }
    }
    computeRoute()
    return () => {
      cancelled = true
    }
  }, [originPoint, destinationPoint])

  const canRequest = !!originPoint && !!destinationPoint && !submitting

  const requestTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canRequest) return addToast({ message: 'Choisissez une origine et une destination dans la liste', tone: 'error' })

    setSubmitting(true)
    try {
      const resp = await createTrip({
        origin: originText,
        origin_lat: originPoint!.lat,
        origin_lng: originPoint!.lng,
        destination: destinationText,
        dest_lat: destinationPoint!.lat,
        dest_lng: destinationPoint!.lng,
        mode: 'PRIVATE',
      })
      const trip = resp.data
      addToast({
        message: trip.price
          ? `Course créée — estimation ${trip.price} XOF (${trip.distance_km?.toFixed?.(1) ?? '—'} km). En attente d'un chauffeur.`
          : "Course créée. En attente d'un chauffeur.",
        tone: 'success',
      })
      const t = await getMyTrips()
      setTrips(t.data)
      const r = await getAvailableChauffeurs()
      setDrivers(r.data)
      setOriginText('')
      setDestinationText('')
      setOriginPoint(null)
      setDestinationPoint(null)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la demande de course', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const payForTrip = async (amount: number, method: string) => {
    if (!modalTrip) return
    try {
      await makePayment({ amount, currency: 'XOF', method, metadata: { trip_id: modalTrip.id } })
      addToast({ message: 'Paiement enregistré. En attente de validation par le chauffeur.', tone: 'info' })
      const p = await getPaymentsSummary()
      setPaymentsSummary(p.data)
      const tx = await getTransactions()
      setTransactions(tx.data)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur paiement', tone: 'error' })
    }
  }

  // Let the passenger tap the map directly to set the destination.
  const handleMapPick = async (point: Point) => {
    setDestinationPoint(point)
    setDestinationText(`Position (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`)
    const label = await reverseGeocode(point.lat, point.lng)
    if (label) setDestinationText(label)
  }

  const mappedDrivers = useMemo(
    () => drivers.map((d) => ({ lat: d.latitude, lng: d.longitude, driver_id: d.id, phone: d.phone, username: d.username })),
    [drivers],
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Bonjour 👋</h1>
      <p className="text-stone-500 mb-6">Où souhaitez-vous aller aujourd'hui ?</p>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Map — large, prominent */}
        <Card className="lg:col-span-3 !p-3" padded={false}>
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <MapPinned size={18} className="text-brand-600" />
            <h2 className="font-semibold text-stone-800">Carte — chauffeurs à proximité</h2>
          </div>
          <DriverMap
            standalone={false}
            height="72vh"
            initialDrivers={mappedDrivers}
            origin={originPoint}
            destination={destinationPoint}
            route={route?.path}
            onMapClick={handleMapPick}
            mapClickHint="Cliquez sur la carte pour choisir la destination"
          />
        </Card>

        {/* Booking card */}
        <Card className="lg:col-span-2 lg:sticky lg:top-20">
          <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <Navigation size={18} className="text-brand-600" />
            Demander une course
          </h2>
          <form onSubmit={requestTrip} className="space-y-4">
            <AddressAutocomplete
              label="Départ"
              placeholder="D'où partez-vous ?"
              value={originText}
              onChange={(v) => {
                setOriginText(v)
                setOriginPoint(null)
              }}
              onSelect={(r) => {
                setOriginText(r.label)
                setOriginPoint({ lat: r.lat, lng: r.lng })
              }}
              near={myPosition || undefined}
              currentPosition={myPosition}
              allowMyLocation
            />
            <AddressAutocomplete
              label="Destination"
              placeholder="Où allez-vous ?"
              value={destinationText}
              onChange={(v) => {
                setDestinationText(v)
                setDestinationPoint(null)
              }}
              onSelect={(r) => {
                setDestinationText(r.label)
                setDestinationPoint({ lat: r.lat, lng: r.lng })
              }}
              near={originPoint || myPosition || undefined}
            />
            <p className="-mt-2 text-xs text-stone-400">Astuce : vous pouvez aussi cliquer directement sur la carte pour placer la destination.</p>

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
        </Card>
      </div>

      {/* History + payments */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <h2 className="font-semibold text-stone-800 mb-3">Historique des courses</h2>
          {trips.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Aucune course pour l'instant.</p>}
          <ul className="divide-y divide-stone-100">
            {trips.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">
                    {t.origin} → {t.destination}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{t.price ? `${t.price} XOF` : 'Prix non estimé'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={t.status} />
                  {t.status === 'COMPLETED' && (
                    <Button size="sm" variant="secondary" onClick={() => setModalTrip(t)}>
                      Payer
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-secondary-600" />
            Paiements
          </h2>
          <div className="rounded-xl bg-secondary-50 px-4 py-3 mb-3">
            <div className="text-xs text-secondary-700">Total dépensé</div>
            <div className="text-xl font-bold text-secondary-800">{paymentsSummary ? paymentsSummary.total_spent : '—'} XOF</div>
          </div>
          {transactions.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Aucune transaction.</p>}
          <ul className="divide-y divide-stone-100">
            {transactions.map((tx) => (
              <li key={tx.id} className="py-2.5 flex items-center justify-between">
                <span className="text-sm text-stone-700">
                  {tx.amount} {tx.currency}
                </span>
                <Badge status={tx.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <PaymentModal visible={!!modalTrip} trip={modalTrip} onClose={() => setModalTrip(null)} onConfirm={payForTrip} />
    </div>
  )
}
