import { useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import DriverMap from '../Map/DriverMap'
import {
  getAvailableChauffeurs,
  getMyTrips,
  createTrip,
  makePayment,
  getTransactions,
  estimatePrice,
  cancelTrip,
  getTrip,
  updateTripVehicleType,
  updateTripPaymentMethod,
} from '../../lib/api'
import PaymentModal from '../../components/PaymentModal'
import { useToasts } from '../../components/Toasts'
import { useAuth } from '../../context/AuthContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import RideStatusBar, { type ActiveTrip } from '../../components/RideStatusBar'
import { getRoute, type Route } from '../../lib/routing'
import { haversineKm } from '../../lib/geo'
import { reverseGeocode } from '../../lib/geocode'
import { useGeolocation } from '../../lib/useGeolocation'
import { connectTripSocket } from '../../lib/socket'
import { MapPinned } from 'lucide-react'

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Point = { lat: number; lng: number }

export default function ClientDashboard() {
  const { user } = useAuth()
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
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
  const [vehicleType, setVehicleType] = useState('CAR')
  const [paymentMethod, setPaymentMethod] = useState('CASH')

  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null)
  const [completedTrip, setCompletedTrip] = useState<ActiveTrip | null>(null)
  const [completedTripPayment, setCompletedTripPayment] = useState<{ id: number; status: string } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [changingVehicleType, setChangingVehicleType] = useState(false)
  const [changingPaymentMethod, setChangingPaymentMethod] = useState(false)
  const tripSocketRef = useRef<Socket | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableChauffeurs()
        setDrivers(r.data)
      } catch (e) {}
      try {
        const t = await getMyTrips()
        setTrips(t.data)
        const ongoing = t.data.find((trip: ActiveTrip) => !TERMINAL_STATUSES.includes(trip.status))
        if (ongoing) setActiveTrip(ongoing)
      } catch (e) {}
    }
    load()
  }, [])

  // Subscribe to realtime updates for the active trip and refresh its full details
  // (driver info, price, status) whenever the backend broadcasts a change.
  useEffect(() => {
    if (!activeTrip?.id) return
    const socket = connectTripSocket(activeTrip.id)
    if (!socket) return
    tripSocketRef.current = socket

    socket.on('message', async (data: any) => {
      if (data.type !== 'trip.update' || data.trip_id !== activeTrip.id) return
      try {
        const r = await getTrip(activeTrip.id)
        if (TERMINAL_STATUSES.includes(r.data.status)) {
          if (r.data.status === 'COMPLETED') {
            setCompletedTrip(r.data)
            await refreshCompletedTripPayment(r.data.id)
          } else {
            setCompletedTrip(null)
            setCompletedTripPayment(null)
          }
          setActiveTrip(null)
          resetRouteForm()
          addToast({
            message: r.data.status === 'CANCELLED' ? 'Course annulée.' : 'Course terminée.',
            tone: r.data.status === 'CANCELLED' ? 'info' : 'success',
          })
          const t = await getMyTrips()
          setTrips(t.data)
        } else {
          setActiveTrip(r.data)
        }
      } catch (e) {}
    })

    return () => {
      socket.disconnect()
      tripSocketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id])

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
        const est = await estimatePrice({ distance_km: distanceKm, vehicle_type: vehicleType, mode: 'PRIVATE' })
        if (!cancelled) setEstimate({ price: est.data.price, distanceKm })
      } catch {
        if (!cancelled) setEstimate(null)
      }
    }
    computeRoute()
    return () => {
      cancelled = true
    }
  }, [originPoint, destinationPoint, vehicleType])

  // Clears the origin/destination form + map trace — only once a trip is truly over
  // (cancelled or completed), not right after submission, so the route stays drawn
  // on the map for the whole lifecycle of an active trip.
  const resetRouteForm = () => {
    setOriginText('')
    setDestinationText('')
    setOriginPoint(null)
    setDestinationPoint(null)
  }

  // Looks up the most recent transaction the passenger created for a given trip, so the
  // "Payer cette course" button can reflect whether one is already pending/failed/paid.
  const refreshCompletedTripPayment = async (tripId: number) => {
    try {
      const t = await getTransactions()
      const mine = t.data.filter((tx: any) => Number(tx.metadata?.trip_id) === tripId)
      setCompletedTripPayment(mine[0] || null)
    } catch (e) {}
  }

  // While a payment is pending, poll for the driver's validation so the passenger's screen
  // clears automatically once it's confirmed (or lets them retry if it failed).
  useEffect(() => {
    if (!completedTrip || completedTripPayment?.status !== 'PENDING') return
    const id = setInterval(async () => {
      const t = await getTransactions().catch(() => null)
      if (!t) return
      const mine = t.data.filter((tx: any) => Number(tx.metadata?.trip_id) === completedTrip.id)
      const latest = mine[0] || null
      if (latest?.status === 'COMPLETED') {
        setCompletedTrip(null)
        setCompletedTripPayment(null)
        addToast({ message: 'Paiement validé par le chauffeur. Merci !', tone: 'success' })
        const t2 = await getMyTrips()
        setTrips(t2.data)
      } else {
        setCompletedTripPayment(latest)
      }
    }, 5000)
    return () => clearInterval(id)
  }, [completedTrip, completedTripPayment?.status])

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
        vehicle_type: vehicleType,
        distance_km: estimate?.distanceKm,
        payment_method: paymentMethod,
      })
      const trip = resp.data
      setActiveTrip(trip)
      setCompletedTrip(null)
      setCompletedTripPayment(null)
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
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la demande de course', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayCompleted = (trip: ActiveTrip) => {
    // Guard against re-opening the modal while a payment is already pending/paid — the
    // button itself is disabled in that case, this just backs it up.
    if (completedTripPayment && completedTripPayment.status !== 'FAILED') return
    setModalTrip(trip)
  }

  const payForTrip = async (amount: number, method: string) => {
    if (!modalTrip) return
    try {
      const resp = await makePayment({ amount, currency: 'XOF', method, metadata: { trip_id: modalTrip.id } })
      setCompletedTripPayment(resp.data)
      addToast({ message: 'Paiement enregistré. En attente de validation par le chauffeur.', tone: 'info' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur paiement', tone: 'error' })
    }
  }

  const handleCancelTrip = async () => {
    if (!activeTrip) return
    setCancelling(true)
    try {
      await cancelTrip(activeTrip.id)
      setActiveTrip(null)
      setCompletedTrip(null)
      setCompletedTripPayment(null)
      resetRouteForm()
      addToast({ message: 'Course annulée.', tone: 'info' })
      const t = await getMyTrips()
      setTrips(t.data)
      const r = await getAvailableChauffeurs()
      setDrivers(r.data)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || "Erreur lors de l'annulation", tone: 'error' })
    } finally {
      setCancelling(false)
    }
  }

  const handleChangeActiveVehicleType = async (type: string) => {
    if (!activeTrip) return
    setChangingVehicleType(true)
    try {
      const r = await updateTripVehicleType(activeTrip.id, type)
      setActiveTrip(r.data)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors du changement de véhicule', tone: 'error' })
    } finally {
      setChangingVehicleType(false)
    }
  }

  const handleChangeActivePaymentMethod = async (method: string) => {
    if (!activeTrip) return
    setChangingPaymentMethod(true)
    try {
      const r = await updateTripPaymentMethod(activeTrip.id, method)
      setActiveTrip(r.data)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors du changement de méthode de paiement', tone: 'error' })
    } finally {
      setChangingPaymentMethod(false)
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
      <h1 className="text-2xl font-bold text-stone-900 mb-1">{new Date().getHours() < 12 ? 'Bonjour' : 'Bonsoir'}{user?.username ? `, ${user.username}` : ''} 👋</h1>
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
            height="60vh"
            initialDrivers={mappedDrivers}
            origin={originPoint}
            destination={destinationPoint}
            route={route?.path}
            onMapClick={handleMapPick}
            mapClickHint="Cliquez sur la carte pour choisir la destination"
          />
        </Card>

        {/* Booking / ride status card */}
        <Card className="lg:col-span-2 lg:top-20">
          <RideStatusBar
            activeTrip={activeTrip}
            completedTrip={completedTrip}
            completedPaymentStatus={completedTripPayment?.status ?? null}
            onPayCompleted={handlePayCompleted}
            originText={originText}
            destinationText={destinationText}
            onOriginChange={(v) => {
              setOriginText(v)
              setOriginPoint(null)
            }}
            onOriginSelect={(r) => {
              setOriginText(r.label)
              setOriginPoint({ lat: r.lat, lng: r.lng })
            }}
            onDestinationChange={(v) => {
              setDestinationText(v)
              setDestinationPoint(null)
            }}
            onDestinationSelect={(r) => {
              setDestinationText(r.label)
              setDestinationPoint({ lat: r.lat, lng: r.lng })
            }}
            myPosition={myPosition}
            originPoint={originPoint}
            routeLoading={routeLoading}
            estimate={estimate}
            route={route}
            submitting={submitting}
            canRequest={canRequest}
            onSubmit={requestTrip}
            vehicleType={vehicleType}
            onVehicleTypeChange={setVehicleType}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            onCancel={handleCancelTrip}
            cancelling={cancelling}
            onChangeActiveVehicleType={handleChangeActiveVehicleType}
            changingVehicleType={changingVehicleType}
            onChangeActivePaymentMethod={handleChangeActivePaymentMethod}
            changingPaymentMethod={changingPaymentMethod}
          />
        </Card>
      </div>

      {/* History + payments */}
      <div className="grid lg:grid-cols-1 gap-6 mt-6">
        <Card padded={false} className="flex flex-col max-h-[60vh]">
          <h2 className="font-semibold text-stone-800 px-5 py-4 border-b border-stone-100 shrink-0">Mes courses</h2>
          <div className="overflow-y-auto px-5 flex-1">
            {trips.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Aucune course pour l'instant.</p>}
            <ul className="divide-y divide-stone-100">
              {trips.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-800 truncate">
                      {t.origin.split(",").slice(0,1).join("")} → {t.destination.split(",").slice(0,1).join("")}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {formatDateTime(t.created_at)} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <PaymentModal visible={!!modalTrip} trip={modalTrip} onClose={() => setModalTrip(null)} onConfirm={payForTrip} />
    </div>
  )
}
