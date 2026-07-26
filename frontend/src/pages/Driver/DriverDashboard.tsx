import { useEffect, useMemo, useState, useRef } from 'react'
import DriverMap from '../Map/DriverMap'
import { getAvailableTrips, claimTrip, getMyActiveTrip, acceptTrip, startTrip, endTrip } from '../../lib/driverApi'
import { getPendingPaymentsForDriver, validateTransaction, setChauffeurAvailability, getTrip } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import { useGeolocation } from '../../lib/useGeolocation'
import { getRoute, type Route } from '../../lib/routing'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { MapPinned, Wallet, Power, Route as RouteIcon, MoonStar, Navigation, UserCheck, Flag } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket, connectTripSocket } from '../../lib/socket'

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Espèces', ORANGE: 'Orange Money', WAVE: 'Wave', FREE: 'Free Money', CARD: 'Carte' }

export default function DriverDashboard() {
  const [trips, setTrips] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [online, setOnline] = useState(false)
  const [toggling, setToggling] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const tripSocketRef = useRef<Socket | null>(null)
  const { addToast } = useToasts()

  const [activeTrip, setActiveTrip] = useState<any | null>(null)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  const { position: myPosition } = useGeolocation({ enabled: online })
  const [route, setRoute] = useState<Route | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const refreshPendingPayments = async () => {
    try {
      const p = await getPendingPaymentsForDriver()
      setPendingPayments(p.data)
    } catch (e) {}
  }

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableTrips()
        setTrips(r.data)
      } catch (e) {}
      await refreshPendingPayments()
      try {
        const a = await getMyActiveTrip()
        if (a.data) {
          setActiveTrip(a.data)
          setOnline(true) // restore the map/live-position view alongside the in-progress trip
        }
      } catch (e) {}
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Broadcast our own live position while online (unrelated to which trip is active).
  useEffect(() => {
    if (!online) return

    const socket = connectDriverSocket()
    if (socket) {
      socketRef.current = socket
      socket.on('message', (data: any) => {
        if (data.type === 'trip.requested' && !activeTrip) {
          setTrips((t) => [data, ...t])
          addToast({ message: `Nouvelle course : ${data.origin} → ${data.destination}`, tone: 'info' })
        }
        if (data.type === 'trip.assigned') {
          setTrips((t) => t.filter((x) => x.id !== data.trip_id))
        }
      })
    }
    return () => {
      socketRef.current?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // Follow the active trip's status in realtime (passenger could cancel while we're still
  // on the way to pick them up, for instance) and keep our local copy fresh.
  useEffect(() => {
    if (!activeTrip?.id) return
    const socket = connectTripSocket(activeTrip.id)
    if (!socket) return
    tripSocketRef.current = socket

    socket.on('message', async (data: any) => {
      if (data.type !== 'trip.update' || data.trip_id !== activeTrip.id) return
      try {
        const r = await getTrip(activeTrip.id)
        if (r.data.status === 'CANCELLED') {
          setActiveTrip(null)
          setRoute(null)
          addToast({ message: 'Le passager a annulé la course.', tone: 'info' })
          const t = await getAvailableTrips()
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

  // Route to draw on the map depends on the phase of the active trip:
  // - before pickup (ASSIGNED/ACCEPTED): from our live position to the passenger's origin.
  // - once the passenger is on board (STARTED): the course they actually requested, origin → destination.
  useEffect(() => {
    let cancelled = false
    async function computeRoute() {
      if (!activeTrip) {
        setRoute(null)
        return
      }
      let origin: { lat: number; lng: number } | null = null
      let destination: { lat: number; lng: number } | null = null

      if (['ASSIGNED', 'ACCEPTED'].includes(activeTrip.status)) {
        if (myPosition && activeTrip.origin_lat != null && activeTrip.origin_lng != null) {
          origin = myPosition
          destination = { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng }
        }
      } else if (activeTrip.status === 'STARTED') {
        if (activeTrip.origin_lat != null && activeTrip.dest_lat != null) {
          origin = { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng }
          destination = { lat: activeTrip.dest_lat, lng: activeTrip.dest_lng }
        }
      }

      if (!origin || !destination) {
        setRoute(null)
        return
      }
      setRouteLoading(true)
      const r = await getRoute(origin, destination)
      if (!cancelled) {
        setRoute(r)
        setRouteLoading(false)
      }
    }
    computeRoute()
    return () => {
      cancelled = true
    }
  }, [activeTrip, myPosition])

  const toggleOnline = async () => {
    setToggling(true)
    const next = !online
    try {
      await setChauffeurAvailability(next)
      setOnline(next)
      addToast({ message: next ? 'Vous êtes en ligne' : 'Vous êtes hors ligne', tone: next ? 'success' : 'info' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Impossible de changer de statut', tone: 'error' })
    } finally {
      setToggling(false)
    }
  }

  // "Prendre" claims the trip and immediately confirms it (accept) — from the driver's point
  // of view this is a single action of taking the course, matching the one button in the UI.
  const handleClaim = async (id: number) => {
    setClaimingId(id)
    try {
      await claimTrip(id)
      await acceptTrip(id)
      const full = await getTrip(id)
      setActiveTrip(full.data)
      setTrips((t) => t.filter((x) => x.id !== id))
      addToast({ message: 'Course acceptée — direction le passager.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    } finally {
      setClaimingId(null)
    }
  }

  const handleClientOnBoard = async () => {
    if (!activeTrip) return
    setStarting(true)
    try {
      await startTrip(activeTrip.id)
      const r = await getTrip(activeTrip.id)
      setActiveTrip(r.data)
      addToast({ message: 'Course démarrée — direction la destination.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    } finally {
      setStarting(false)
    }
  }

  const handleArrived = async () => {
    if (!activeTrip) return
    setEnding(true)
    try {
      await endTrip(activeTrip.id)
      const r = await getTrip(activeTrip.id)
      setActiveTrip(r.data)
      await refreshPendingPayments()
      addToast({ message: 'Arrivée signalée — course terminée.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    } finally {
      setEnding(false)
    }
  }

  const handleValidatePayment = async (txId: number, clearActive?: boolean) => {
    try {
      await validateTransaction(txId)
      addToast({ message: 'Paiement validé', tone: 'success' })
      await refreshPendingPayments()
      if (clearActive) setActiveTrip(null)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    }
  }

  // The pending transaction (if any) the passenger created for the active trip once it's over.
  const activeTripPayment = useMemo(
    () => (activeTrip ? pendingPayments.find((tx) => Number(tx.metadata?.trip_id) === activeTrip.id) : null),
    [activeTrip, pendingPayments],
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Espace chauffeur</h1>
          <p className="text-stone-500 text-sm">Gérez vos courses et votre disponibilité.</p>
        </div>
        <Button
          onClick={toggleOnline}
          loading={toggling}
          disabled={!!activeTrip}
          variant={online ? 'secondary' : 'outline'}
          icon={<Power size={16} />}
          className="!rounded-full"
        >
          {online ? 'En ligne' : 'Hors ligne'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <Card className="lg:col-span-3 !p-3" padded={false}>
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <MapPinned size={18} className="text-brand-600" />
            <h2 className="font-semibold text-stone-800">
              {activeTrip?.status === 'STARTED'
                ? 'Trajet vers la destination'
                : activeTrip
                  ? 'Trajet vers le passager'
                  : 'Votre position en direct'}
            </h2>
            {routeLoading && <span className="text-xs text-stone-400">Calcul de l'itinéraire…</span>}
          </div>
          {online ? (
            <DriverMap
              standalone={false}
              height="65vh"
              role="driver"
              origin={
                activeTrip?.status === 'STARTED' && activeTrip.origin_lat != null
                  ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng }
                  : null
              }
              destination={
                activeTrip
                  ? activeTrip.status === 'STARTED'
                    ? activeTrip.dest_lat != null
                      ? { lat: activeTrip.dest_lat, lng: activeTrip.dest_lng }
                      : null
                    : activeTrip.origin_lat != null
                      ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng }
                      : null
                  : null
              }
              route={route?.path}
              onSocketError={(msg) => {
                addToast({ message: msg, tone: 'error' })
                setOnline(false)
              }}
            />
          ) : (
            <div className="h-[65vh] grid place-items-center rounded-2xl bg-stone-50 text-stone-400">
              <div className="text-center">
                <MoonStar size={28} className="mx-auto mb-2" />
                <p className="text-sm">Passez en ligne pour partager votre position et recevoir des courses.</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          {activeTrip ? (
            <div>
              <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <Navigation size={18} className="text-brand-600" />
                Course en cours
                <Badge status={activeTrip.status} />
              </h2>

              <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 mb-4 space-y-1.5">
                <div className="text-sm text-stone-700 truncate">
                  <span className="font-medium">{activeTrip.origin}</span>
                </div>
                <div className="text-sm text-stone-700 truncate">→ <span className="font-medium">{activeTrip.destination}</span></div>
                <div className="text-xs text-stone-400 mt-1">
                  {activeTrip.distance_km ? `${Number(activeTrip.distance_km).toFixed(1)} km` : '—'} · {activeTrip.price ? `${activeTrip.price} XOF` : 'Prix non estimé'}
                </div>
              </div>

              {['ASSIGNED', 'ACCEPTED'].includes(activeTrip.status) && (
                <Button fullWidth size="lg" icon={<UserCheck size={16} />} onClick={handleClientOnBoard} loading={starting}>
                  Client à bord
                </Button>
              )}

              {activeTrip.status === 'STARTED' && (
                <Button fullWidth size="lg" icon={<Flag size={16} />} onClick={handleArrived} loading={ending}>
                  Arrivé à destination
                </Button>
              )}

              {activeTrip.status === 'COMPLETED' && (
                <div>
                  <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-3 mb-3">
                    <div className="text-xs text-secondary-700 flex items-center gap-1.5">
                      <Wallet size={14} />
                      Moyen de paiement du client
                    </div>
                    <div className="text-lg font-bold text-secondary-800">
                      {PAYMENT_LABELS[activeTrip.payment_method] || activeTrip.payment_method}
                    </div>
                  </div>
                  {activeTripPayment ? (
                    <Button fullWidth size="lg" variant="secondary" onClick={() => handleValidatePayment(activeTripPayment.id, true)}>
                      Confirmer le paiement reçu
                    </Button>
                  ) : (
                    <div className="text-sm text-stone-400 text-center py-2 mb-2">En attente que le passager règle la course…</div>
                  )}
                  <Button fullWidth variant="ghost" className="mt-2" onClick={() => setActiveTrip(null)}>
                    Fermer
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <RouteIcon size={18} className="text-brand-600" />
                Courses disponibles
              </h2>
              {trips.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Aucune course en attente pour l'instant.</p>}
              <ul className="space-y-2.5">
                {trips.map((t) => (
                  <li key={t.id} className="rounded-xl border border-stone-100 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-800 truncate">
                        {t.origin.split(',').slice(0, 1).join('')} → {t.destination.split(',').slice(0, 1).join('')}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleClaim(t.id)} loading={claimingId === t.id}>
                      Prendre
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
          <Wallet size={18} className="text-secondary-600" />
          Paiements en attente
        </h2>
        {pendingPayments.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Aucun paiement en attente.</p>}
        <ul className="divide-y divide-stone-100">
          {pendingPayments.map((tx) => (
            <li key={tx.id} className="py-3 flex items-center justify-between gap-3">
              <div className="text-sm text-stone-700">
                Course #{tx.metadata?.trip_id} — <span className="font-medium">{tx.amount} {tx.currency}</span> · {PAYMENT_LABELS[tx.method] || tx.method}
              </div>
              <div className="flex items-center gap-2">
                <Badge status={tx.status} />
                <Button size="sm" variant="secondary" onClick={() => handleValidatePayment(tx.id)}>
                  Valider
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
