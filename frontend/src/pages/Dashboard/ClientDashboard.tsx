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
  rateTrip,
  skipTripRating,
} from '../../lib/api'
import PaymentModal from '../../components/PaymentModal'
import TripDetailModal from '../../components/TripDetailModal'
import { useToasts } from '../../components/Toasts'
import { useAuth } from '../../context/AuthContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Reveal from '../../components/ui/Reveal'
import Skeleton from '../../components/ui/Skeleton'
import RideStatusBar, { type ActiveTrip } from '../../components/RideStatusBar'
import { getRoute, type Route } from '../../lib/routing'
import { haversineKm } from '../../lib/geo'
import { reverseGeocode } from '../../lib/geocode'
import { useGeolocation } from '../../lib/useGeolocation'
import { connectTripSocket, connectDriversSocket } from '../../lib/socket'
import { addRecent } from '../../lib/favorites'
import TripHistoryFilters, { type StatusFilter } from '../../components/TripHistoryFilters'
import { MapPinned, Inbox, ArrowRight, SearchX } from 'lucide-react'

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'STARTED']

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Point = { lat: number; lng: number }

export default function ClientDashboard() {
  const { user } = useAuth()
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [modalTrip, setModalTrip] = useState<any | null>(null)
  const [detailTrip, setDetailTrip] = useState<any | null>(null)
  const { addToast } = useToasts()

  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState<StatusFilter>('ALL')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyMinAmount, setHistoryMinAmount] = useState('')
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false)
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
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [driverEtaMin, setDriverEtaMin] = useState<number | null>(null)
  const tripSocketRef = useRef<Socket | null>(null)
  // Guards against handling the same trip's terminal transition (cancel/complete) twice —
  // it can be reported both by the direct REST response and by the trip socket broadcast.
  const terminalHandledTripIdRef = useRef<number | null>(null)

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
      } catch (e) {
      } finally {
        setTripsLoading(false)
      }
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
          // The passenger's own cancellation already handles this locally (see handleCancelTrip)
          // right as its REST call resolves — skip here so the toast doesn't fire twice.
          if (terminalHandledTripIdRef.current !== r.data.id) {
            terminalHandledTripIdRef.current = r.data.id
            setActiveTrip(null)
            resetRouteForm()
            addToast({
              message: r.data.status === 'CANCELLED' ? 'Course annulée.' : 'Course terminée.',
              tone: r.data.status === 'CANCELLED' ? 'info' : 'success',
            })
          }
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

  // Once a driver is assigned, track their live position (broadcast on the same public
  // 'drivers' channel the map uses) and turn it into a real road-route ETA — to the pickup
  // point while they're still on their way to us, then to the destination once we're on board.
  // Throttled: recomputing on every ~4s position ping would hammer the OSRM demo server for a
  // number that barely changes second to second.
  useEffect(() => {
    const driverId = activeTrip?.driver_detail?.id
    const status = activeTrip?.status
    if (!driverId || !status || !['ASSIGNED', 'ACCEPTED', 'STARTED'].includes(status)) {
      setDriverEtaMin(null)
      return
    }
    const target =
      status === 'STARTED'
        ? activeTrip!.dest_lat != null && activeTrip!.dest_lng != null
          ? { lat: activeTrip!.dest_lat, lng: activeTrip!.dest_lng }
          : null
        : activeTrip!.origin_lat != null && activeTrip!.origin_lng != null
          ? { lat: activeTrip!.origin_lat, lng: activeTrip!.origin_lng }
          : null
    if (!target) return

    const socket = connectDriversSocket()
    if (!socket) return
    let lastComputedAt = 0
    let cancelled = false

    socket.on('message', async (data: any) => {
      if (data.type !== 'broadcast.location' || data.driver_id !== driverId) return
      const now = Date.now()
      if (now - lastComputedAt < 15000) return
      lastComputedAt = now
      const r = await getRoute({ lat: data.lat, lng: data.lng }, target)
      if (!cancelled && r) setDriverEtaMin(r.durationMin)
    })

    return () => {
      cancelled = true
      socket.disconnect()
    }
  }, [activeTrip?.driver_detail?.id, activeTrip?.status])

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

  // While a payment is pending, poll for the driver's validation. Once confirmed we keep the
  // completed-trip card up (now showing the rating step) instead of clearing it — rating only
  // makes sense to ask for once the ride is fully settled, payment included.
  useEffect(() => {
    if (!completedTrip || completedTripPayment?.status !== 'PENDING') return
    const id = setInterval(async () => {
      const t = await getTransactions().catch(() => null)
      if (!t) return
      const mine = t.data.filter((tx: any) => Number(tx.metadata?.trip_id) === completedTrip.id)
      const latest = mine[0] || null
      if (latest?.status === 'COMPLETED') {
        setCompletedTripPayment(latest)
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
      addRecent({ label: destinationText, lat: destinationPoint!.lat, lng: destinationPoint!.lng })
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

  // Keeps every place a trip's rating is shown (the completed-trip card, the history list,
  // and the detail modal) in sync after rating/skipping, without a full refetch.
  const applyRatingToAllViews = (tripId: number, rating: any) => {
    setCompletedTrip((t) => (t && t.id === tripId ? { ...t, rating } : t))
    setDetailTrip((t: any) => (t && t.id === tripId ? { ...t, rating } : t))
    setTrips((list) => list.map((t) => (t.id === tripId ? { ...t, rating } : t)))
  }

  // Rating the trip that's currently occupying the "completed" card is the last step of its
  // lifecycle (request → ride → pay → rate) — once done, hand the dashboard back to idle.
  // Rating an older trip from the history modal, on the other hand, shouldn't touch it.
  const finishIfActiveCompleted = (tripId: number) => {
    if (completedTrip?.id !== tripId) return
    setCompletedTrip(null)
    setCompletedTripPayment(null)
    resetRouteForm()
  }

  const handleRateTrip = async (trip: ActiveTrip, rating: number, comment?: string) => {
    setRatingSubmitting(true)
    try {
      const resp = await rateTrip(trip.id, rating, comment)
      applyRatingToAllViews(trip.id, resp.data)
      addToast({ message: 'Merci pour votre note !', tone: 'success' })
      finishIfActiveCompleted(trip.id)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de l\'envoi de la note', tone: 'error' })
    } finally {
      setRatingSubmitting(false)
    }
  }

  const handleSkipRating = async (trip: ActiveTrip) => {
    try {
      const resp = await skipTripRating(trip.id)
      applyRatingToAllViews(trip.id, resp.data)
      finishIfActiveCompleted(trip.id)
    } catch (e: any) {
      // Non-blocking — worst case the rating card just stays visible for another try.
    }
  }

  const handleCancelTrip = async () => {
    if (!activeTrip) return
    setCancelling(true)
    try {
      await cancelTrip(activeTrip.id)
      // The trip socket also reports this same cancellation (see the listener above) — guard
      // so whichever of the two fires first is the one that updates the UI and shows the toast.
      if (terminalHandledTripIdRef.current !== activeTrip.id) {
        terminalHandledTripIdRef.current = activeTrip.id
        setActiveTrip(null)
        setCompletedTrip(null)
        setCompletedTripPayment(null)
        resetRouteForm()
        addToast({ message: 'Course annulée.', tone: 'info' })
      }
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
    () => drivers.map((d) => ({ lat: d.latitude, lng: d.longitude, driver_id: d.id, phone: d.phone, username: d.username, vehicle: d.vehicle })),
    [drivers],
  )

  const historyActiveFilterCount = [
    historyStatus !== 'ALL',
    !!historyDateFrom,
    !!historyDateTo,
    !!historyMinAmount,
  ].filter(Boolean).length

  const resetHistoryFilters = () => {
    setHistoryStatus('ALL')
    setHistoryDateFrom('')
    setHistoryDateTo('')
    setHistoryMinAmount('')
  }

  const filteredTrips = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    const fromTime = historyDateFrom ? new Date(historyDateFrom).getTime() : null
    // End-of-day so a trip made on the "to" date itself is included.
    const toTime = historyDateTo ? new Date(historyDateTo).getTime() + 24 * 60 * 60 * 1000 : null
    const minAmountNum = historyMinAmount ? Number(historyMinAmount) : null

    return trips.filter((t) => {
      if (query && !`${t.origin} ${t.destination}`.toLowerCase().includes(query)) return false
      if (historyStatus === 'ONGOING' && !ONGOING_STATUSES.includes(t.status)) return false
      if (historyStatus === 'COMPLETED' && t.status !== 'COMPLETED') return false
      if (historyStatus === 'CANCELLED' && t.status !== 'CANCELLED') return false
      const createdTime = new Date(t.created_at).getTime()
      if (fromTime != null && createdTime < fromTime) return false
      if (toTime != null && createdTime >= toTime) return false
      if (minAmountNum != null && !Number.isNaN(minAmountNum) && (t.price ?? 0) < minAmountNum) return false
      return true
    })
  }, [trips, historySearch, historyStatus, historyDateFrom, historyDateTo, historyMinAmount])

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[36rem] h-72 rounded-full bg-brand-300/10 blur-3xl -z-10" />

      <Reveal variant="fade">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient text-white px-6 py-6 sm:py-7 mb-6">
          <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 animate-float-slow" />
          <div className="pointer-events-none absolute -left-6 -bottom-10 w-36 h-36 rounded-full bg-white/10 animate-float" />
          <h1 className="relative text-2xl font-bold mb-1">
            {new Date().getHours() < 12 ? 'Bonjour' : 'Bonsoir'}
            {user?.username ? `, ${user.username}` : ''} <span className="animate-wave">👋</span>
          </h1>
          <p className="relative text-white/80">Où souhaitez-vous aller aujourd'hui ?</p>
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Map — large, prominent */}
        <Reveal variant="left" className="lg:col-span-3">
          <Card className="!p-3 transition-shadow duration-300 hover:shadow-floating" padded={false}>
            <div className="flex items-center gap-2 px-2 pt-1 pb-2">
              <MapPinned size={18} className="text-brand-600" />
              <h2 className="font-semibold text-stone-800 dark:text-stone-100">Carte — chauffeurs à proximité</h2>
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
        </Reveal>

        {/* Booking / ride status card */}
        <Reveal variant="right" delay={100} className="lg:col-span-2">
          <Card className="lg:top-20 transition-shadow duration-300 hover:shadow-floating">
          <RideStatusBar
            activeTrip={activeTrip}
            completedTrip={completedTrip}
            completedPaymentStatus={completedTripPayment?.status ?? null}
            onPayCompleted={handlePayCompleted}
            onRateTrip={handleRateTrip}
            onSkipRating={handleSkipRating}
            ratingSubmitting={ratingSubmitting}
            driverEtaMin={driverEtaMin}
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
        </Reveal>
      </div>

      {/* History + payments */}
      <Reveal variant="up" delay={150} className="grid lg:grid-cols-1 gap-6 mt-6">
        <Card padded={false} className="flex flex-col max-h-[60vh] transition-shadow duration-300 hover:shadow-floating">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
            <h2 className="font-semibold text-stone-800 dark:text-stone-100">Mes courses</h2>
            {!tripsLoading && trips.length > 0 && (
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
                <span className="font-semibold text-stone-600 dark:text-stone-300">{filteredTrips.length}</span>
                {filteredTrips.length !== trips.length ? ` / ${trips.length}` : ' au total'}
              </span>
            )}
          </div>
          {!tripsLoading && trips.length > 0 && (
            <TripHistoryFilters
              search={historySearch}
              onSearchChange={setHistorySearch}
              status={historyStatus}
              onStatusChange={setHistoryStatus}
              dateFrom={historyDateFrom}
              onDateFromChange={setHistoryDateFrom}
              dateTo={historyDateTo}
              onDateToChange={setHistoryDateTo}
              minAmount={historyMinAmount}
              onMinAmountChange={setHistoryMinAmount}
              open={historyFiltersOpen}
              onToggleOpen={() => setHistoryFiltersOpen((v) => !v)}
              activeCount={historyActiveFilterCount}
              onReset={resetHistoryFilters}
            />
          )}
          <div className="overflow-y-auto px-5 flex-1">
            {tripsLoading ? (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                  </li>
                ))}
              </ul>
            ) : trips.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 text-stone-400 dark:text-stone-500">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 dark:bg-stone-800 mb-3">
                  <Inbox size={22} />
                </span>
                <p className="text-sm">Aucune course pour l'instant.</p>
                <p className="text-xs mt-1 max-w-xs">Votre historique de courses apparaîtra ici dès votre première réservation.</p>
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 text-stone-400 dark:text-stone-500">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 dark:bg-stone-800 mb-3">
                  <SearchX size={22} />
                </span>
                <p className="text-sm">Aucune course ne correspond à ces filtres.</p>
                <button type="button" onClick={resetHistoryFilters} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline mt-1">
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredTrips.map((t, i) => (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailTrip(t)}
                    onKeyDown={(e) => e.key === 'Enter' && setDetailTrip(t)}
                    className="group py-3 flex items-center justify-between gap-3 animate-fade-in-up transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60 -mx-2 px-2 rounded-lg cursor-pointer"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="grid place-items-center w-8 h-8 rounded-lg bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 shrink-0 transition-colors group-hover:bg-brand-50 dark:group-hover:bg-brand-500/10 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        <ArrowRight size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                          {t.origin.split(",").slice(0,1).join("")} → {t.destination.split(",").slice(0,1).join("")}
                        </div>
                        <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                          {formatDateTime(t.created_at)} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.status === 'COMPLETED' && !t.rating && (
                        <span className="text-[11px] font-medium text-accent-600 bg-accent-300/15 rounded-full px-2 py-1">À noter</span>
                      )}
                      <Badge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </Reveal>

      <PaymentModal visible={!!modalTrip} trip={modalTrip} onClose={() => setModalTrip(null)} onConfirm={payForTrip} />
      <TripDetailModal
        trip={detailTrip}
        onClose={() => setDetailTrip(null)}
        onRate={handleRateTrip}
        onSkipRating={handleSkipRating}
        ratingSubmitting={ratingSubmitting}
      />
    </div>
  )
}
