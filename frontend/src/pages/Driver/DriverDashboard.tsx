import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DriverMap from '../Map/DriverMap'
import { getAvailableTrips, claimTrip, getMyActiveTrip, acceptTrip, arriveTrip, startTrip, endTrip, getDriverHistory, triggerDriverSos } from '../../lib/driverApi'
import { getPendingPaymentsForDriver, validateTransaction, setChauffeurAvailability, getTrip, getMyChauffeurProfile, getChauffeurRatingSummary } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import { useAuth } from '../../context/AuthContext'
import { useGeolocation } from '../../lib/useGeolocation'
import { getRoute, type Route } from '../../lib/routing'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Reveal from '../../components/ui/Reveal'
import Skeleton from '../../components/ui/Skeleton'
import TripHistoryFilters, { type StatusFilter } from '../../components/TripHistoryFilters'
import TripDetailModal from '../../components/TripDetailModal'
import NewTripOfferModal from '../../components/NewTripOfferModal'
import ChauffeurDocumentsModal from '../../components/ChauffeurDocumentsModal'
import { MapPinned, Wallet, Route as RouteIcon, MoonStar, Navigation, UserCheck, Flag, MapPin, ShieldAlert, Clock, Star, Siren, Inbox, ArrowRight, SearchX, CheckCircle2, Circle } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket, connectTripSocket } from '../../lib/socket'
import { haversineKm } from '../../lib/geo'
import { useAuth } from '../../context/AuthContext'

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED']

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Espèces', ORANGE: 'Orange Money', WAVE: 'Wave', FREE: 'Free Money', CARD: 'Carte' }

const TRIP_STEPS = ['Accepté', 'Arrivé', 'En route', 'Terminée']

function tripStepIndex(status: string) {
  if (status === 'ARRIVED') return 1
  if (status === 'STARTED') return 2
  if (status === 'COMPLETED') return 3
  return 0
}

function TripStepper({ status }: { status: string }) {
  const activeIndex = tripStepIndex(status)
  return (
    <div className="flex items-center mb-4">
      {TRIP_STEPS.map((label, i) => (
        <div key={label} className={`flex items-center ${i < TRIP_STEPS.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            {i < activeIndex ? (
              <CheckCircle2 size={18} className="text-secondary-500" />
            ) : i === activeIndex ? (
              <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-brand-500 text-white text-[10px] font-bold ring-4 ring-brand-100 animate-pulse-slow">
                {i + 1}
              </span>
            ) : (
              <Circle size={18} className="text-stone-200" />
            )}
            <span className={`text-[10px] font-medium whitespace-nowrap ${i <= activeIndex ? 'text-stone-600' : 'text-stone-300'}`}>{label}</span>
          </div>
          {i < TRIP_STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-4 rounded transition-colors duration-500 ${i < activeIndex ? 'bg-secondary-400' : 'bg-stone-100'}`} />}
        </div>
      ))}
    </div>
  )
}

// Must match MAX_CLAIM_RADIUS_KM on the backend (backend-node/src/modules/trips/trips.routes.ts) —
// a claim outside this radius is rejected server-side regardless, this just avoids a round-trip.
const MAX_CLAIM_RADIUS_KM = 5

export default function DriverDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  // Online/offline (and the localStorage persistence + POST /availability/ sync) now lives in
  // AuthContext — it's what lets the chauffeur's position feed run on any page, not just this
  // one, and defaults to online (going offline is the explicit, exceptional action).
  const { driverOnline: online, setDriverOnline } = useAuth()
  const [toggling, setToggling] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const tripSocketRef = useRef<Socket | null>(null)
  const { addToast } = useToasts()

  const [activeTrip, setActiveTrip] = useState<any | null>(null)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [arriving, setArriving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [sosSubmitting, setSosSubmitting] = useState(false)

  const { position: myPosition } = useGeolocation({ enabled: online })
  const [route, setRoute] = useState<Route | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const [verification, setVerification] = useState<{ id: number; is_verified: boolean; permit: string | null; insurance: string | null } | null>(null)
  const [rating, setRating] = useState<{ average: number | null; count: number } | null>(null)
  const [docsModalOpen, setDocsModalOpen] = useState(false)

  // Incoming trip requests get a dedicated modal offer (with a response countdown) instead of
  // just quietly landing in the list below — a queue rather than a single slot so a second
  // request arriving while the first is still up doesn't get silently dropped.
  const [offerQueue, setOfferQueue] = useState<any[]>([])
  const currentOffer = offerQueue[0] ?? null

  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [detailTrip, setDetailTrip] = useState<any | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState<StatusFilter>('ALL')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyMinAmount, setHistoryMinAmount] = useState('')
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false)

  useEffect(() => {
    getMyChauffeurProfile()
      .then((r) => {
        setVerification(r.data)
        // Pops up right away on login/landing — the whole point is that finishing the
        // dossier isn't something a driver has to remember to go dig for in settings.
        if (!r.data.is_verified && (!r.data.permit || !r.data.insurance)) setDocsModalOpen(true)
      })
      .catch((e) => {
        // A CHAUFFEUR-role user always lands here straight after login (see Login.tsx) —
        // but the very first time, before they've ever submitted the vehicle step, no
        // chauffeur profile exists yet (404) and the whole dashboard would silently render
        // empty. Send them to finish that step instead of leaving them stranded.
        if (e?.response?.status === 404) navigate('/onboard/chauffeur', { replace: true })
      })
    getDriverHistory()
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDocsSubmitted = () => {
    setDocsModalOpen(false)
    getMyChauffeurProfile()
      .then((r) => setVerification(r.data))
      .catch(() => {})
  }

  // The driver's own rating, shown as a quiet badge in the header — needs the chauffeur id
  // from /chauffeurs/me/ first, so it trails the verification fetch above by one tick.
  useEffect(() => {
    if (!verification?.id) return
    getChauffeurRatingSummary(verification.id)
      .then((r) => setRating(r.data))
      .catch(() => {})
  }, [verification?.id])

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
          if (!online) {
            try {
              await setDriverOnline(true)
            } catch (e) {}
          }
        }
      } catch (e) {}
      // Re-affirm availability with the server on mount (covers e.g. a page reload) whenever
      // we're supposed to be online — matches the "online by default" flag owned by AuthContext.
      if (online) {
        try {
          await setChauffeurAvailability(true)
        } catch (e) {}
      }
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
          setOfferQueue((q) => (q.some((o) => o.id === data.id) ? q : [...q, data]))
        }
        if (data.type === 'trip.assigned') {
          setTrips((t) => t.filter((x) => x.id !== data.trip_id))
          setOfferQueue((q) => q.filter((o) => o.id !== data.trip_id))
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
          getDriverHistory().then((h) => setHistory(h.data)).catch(() => {})
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
      await setDriverOnline(next)
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
      setOfferQueue((q) => q.filter((o) => o.id !== id))
      addToast({ message: 'Course acceptée — direction le passager.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    } finally {
      setClaimingId(null)
    }
  }

  const handleDeclineOffer = () => {
    if (!currentOffer) return
    setOfferQueue((q) => q.filter((o) => o.id !== currentOffer.id))
  }

  const handleSos = async () => {
    if (!activeTrip) return
    setSosSubmitting(true)
    try {
      await triggerDriverSos(activeTrip.id, myPosition?.lat, myPosition?.lng)
      addToast({ message: 'Alerte envoyée à notre équipe avec votre position.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || "Erreur lors de l'envoi de l'alerte — appelez directement les secours.", tone: 'error' })
    } finally {
      setSosSubmitting(false)
      window.location.href = `tel:${import.meta.env.VITE_EMERGENCY_PHONE || '17'}`
    }
  }

  const handleArrivedAtPickup = async () => {
    if (!activeTrip) return
    setArriving(true)
    try {
      await arriveTrip(activeTrip.id)
      setActiveTrip((t: any) => (t ? { ...t, status: 'ARRIVED' } : t))
      addToast({ message: 'Passager notifié de votre arrivée.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    } finally {
      setArriving(false)
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
      getDriverHistory().then((h) => setHistory(h.data)).catch(() => {})
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

  // Sort available trips by distance from the driver (closest first) — but never hide any of
  // them. A hard radius cutoff here used to silently make legitimately nearby requests
  // disappear whenever the browser's GPS fix was briefly inaccurate or stale, which looked
  // like "I can't accept a trip in my own sector" from the driver's side. Showing everything,
  // ordered by distance, keeps the app honest about what's actually available.
  const nearbyTrips = useMemo(() => {
    if (!myPosition) return trips
    return [...trips].sort((a, b) => {
      const da = a.origin_lat != null && a.origin_lng != null ? haversineKm(myPosition, { lat: a.origin_lat, lng: a.origin_lng }) : Infinity
      const db = b.origin_lat != null && b.origin_lng != null ? haversineKm(myPosition, { lat: b.origin_lat, lng: b.origin_lng }) : Infinity
      return da - db
    })
  }, [trips, myPosition])

  // While a completed trip is awaiting payment, poll so "Le passager a payé" enables itself
  // as soon as the passenger submits their payment, without needing a manual refresh.
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'COMPLETED' || activeTripPayment) return
    const id = setInterval(() => {
      refreshPendingPayments()
    }, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id, activeTrip?.status, activeTripPayment])

  const historyActiveFilterCount = [historyStatus !== 'ALL', !!historyDateFrom, !!historyDateTo, !!historyMinAmount].filter(Boolean).length

  const resetHistoryFilters = () => {
    setHistoryStatus('ALL')
    setHistoryDateFrom('')
    setHistoryDateTo('')
    setHistoryMinAmount('')
  }

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    const fromTime = historyDateFrom ? new Date(historyDateFrom).getTime() : null
    const toTime = historyDateTo ? new Date(historyDateTo).getTime() + 24 * 60 * 60 * 1000 : null
    const minAmountNum = historyMinAmount ? Number(historyMinAmount) : null

    return history.filter((t) => {
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
  }, [history, historySearch, historyStatus, historyDateFrom, historyDateTo, historyMinAmount])

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[36rem] h-72 rounded-full bg-brand-300/10 blur-3xl -z-10" />

      <Reveal variant="fade">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient text-white px-6 py-6 sm:py-7 mb-6">
          <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 animate-float-slow" />
          <div className="pointer-events-none absolute -left-6 -bottom-10 w-36 h-36 rounded-full bg-white/10 animate-float" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {new Date().getHours() < 12 ? 'Bonjour' : 'Bonsoir'}
                {user?.username ? `, ${user.username}` : ''} <span className="animate-wave">👋</span>
              </h1>
              <p className="text-white/80 flex items-center gap-2 flex-wrap">
                {online ? 'Vous êtes en ligne — prêt à recevoir des courses.' : 'Passez en ligne pour commencer à rouler.'}
                {rating && rating.count > 0 && (
                  <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-semibold">
                    <Star size={12} fill="currentColor" />
                    {rating.average} ({rating.count})
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleOnline}
              disabled={!!activeTrip || toggling}
              title={activeTrip ? 'Impossible de changer de statut pendant une course' : undefined}
              className={`group relative inline-flex items-center gap-2.5 rounded-full pl-3 pr-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                online ? 'bg-white text-secondary-700 shadow-floating' : 'bg-white/10 text-white border border-white/30 hover:bg-white/20'
              }`}
            >
              {toggling ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
              ) : online ? (
                <span className="live-dot !w-3.5 !h-3.5" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-white/40 group-hover:bg-white/60 transition-colors" />
              )}
              {online ? 'En ligne' : 'Hors ligne'}
            </button>
          </div>
        </div>
      </Reveal>

      {verification && !verification.is_verified && (
        <Reveal variant="up">
          <Card className="mb-6 !py-3.5 border-accent-300/60 bg-accent-300/10">
            {verification.permit && verification.insurance ? (
              <div className="flex items-center gap-3 text-sm text-accent-800">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-300/30 shrink-0 animate-pulse-slow">
                  <Clock size={15} />
                </span>
                Documents envoyés — en attente de vérification par notre équipe.
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-sm text-accent-800">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-300/30 shrink-0">
                    <ShieldAlert size={15} />
                  </span>
                  Profil incomplet — ajoutez vos documents pour être activé.
                </div>
                <Button size="sm" variant="outline" onClick={() => setDocsModalOpen(true)}>
                  Compléter mon profil
                </Button>
              </div>
            )}
          </Card>
        </Reveal>
      )}

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <Reveal variant="left" className="lg:col-span-3">
        <Card className="!p-3 transition-shadow duration-300 hover:shadow-floating" padded={false}>
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <MapPinned size={18} className="text-brand-600" />
            <h2 className="font-semibold text-stone-800">
              {activeTrip?.status === 'STARTED'
                ? 'Trajet vers la destination'
                : activeTrip?.status === 'ARRIVED'
                  ? 'Arrivé au point de rendez-vous'
                  : activeTrip
                    ? 'Trajet vers le passager'
                    : 'Votre position en direct'}
            </h2>
            {routeLoading && <span className="text-xs text-stone-400">Calcul de l'itinéraire…</span>}
          </div>
          {online ? (
            <DriverMap
              standalone={false}
              height="60vh"
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
                setDriverOnline(false).catch(() => {})
              }}
            />
          ) : (
            <div className="h-[65vh] grid place-items-center rounded-2xl bg-stone-50 text-stone-400">
              <div className="text-center px-6">
                <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-white text-brand-400 shadow-card mb-3 animate-float-slow">
                  <MoonStar size={24} />
                </span>
                <p className="text-sm font-medium text-stone-500">Vous êtes hors ligne</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">Passez en ligne pour partager votre position et recevoir des courses.</p>
              </div>
            </div>
          )}
        </Card>
        </Reveal>

        <Reveal variant="right" delay={100} className="lg:col-span-2">
        <Card className="transition-shadow duration-300 hover:shadow-floating">
          {activeTrip ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-semibold text-stone-800 flex items-center gap-2">
                  <Navigation size={18} className="text-brand-600" />
                  Course en cours
                  <Badge status={activeTrip.status} />
                </h2>
                {activeTrip.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={handleSos}
                    disabled={sosSubmitting}
                    title="Alerte SOS"
                    className="grid place-items-center w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors shrink-0 disabled:opacity-60"
                  >
                    <Siren size={15} />
                  </button>
                )}
              </div>

              <TripStepper status={activeTrip.status} />

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
                <Button fullWidth size="lg" icon={<MapPin size={16} />} onClick={handleArrivedAtPickup} loading={arriving}>
                  Je suis arrivé
                </Button>
              )}

              {activeTrip.status === 'ARRIVED' && (
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
                  {!activeTripPayment && (
                    <div className="text-sm text-stone-400 text-center py-2 mb-2">En attente que le passager règle la course…</div>
                  )}
                  <Button
                    fullWidth
                    size="lg"
                    variant="secondary"
                    disabled={!activeTripPayment}
                    onClick={() => activeTripPayment && handleValidatePayment(activeTripPayment.id, true)}
                  >
                    Le passager a payé
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <RouteIcon size={18} className="text-brand-600" />
                Courses disponibles
                {myPosition && (
                  <span className="text-xs font-normal text-stone-400 ml-1">
                    · vous pouvez accepter celles à moins de {MAX_CLAIM_RADIUS_KM} km
                  </span>
                )}
              </h2>
              {nearbyTrips.length === 0 && (
                <div className="flex flex-col items-center text-center py-10 text-stone-400">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 mb-3">
                    <RouteIcon size={22} />
                  </span>
                  <p className="text-sm">Aucune course en attente pour l'instant.</p>
                  <p className="text-xs mt-1 max-w-xs">Restez en ligne — les nouvelles demandes apparaîtront ici automatiquement.</p>
                </div>
              )}
              <ul className="space-y-2.5">
                {nearbyTrips.map((t, i) => {
                  const distFromDriver = myPosition && t.origin_lat != null && t.origin_lng != null
                    ? haversineKm(myPosition, { lat: t.origin_lat, lng: t.origin_lng })
                    : null
                  const outOfRange = distFromDriver != null && distFromDriver > MAX_CLAIM_RADIUS_KM
                  return (
                    <li
                      key={t.id}
                      className={`animate-fade-in-up rounded-xl border p-3 flex items-center justify-between gap-3 transition-all duration-200 ${
                        outOfRange ? 'border-stone-100 bg-stone-50/60 opacity-70' : 'border-stone-100 hover:border-brand-200 hover:shadow-card'
                      }`}
                      style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${outOfRange ? 'bg-stone-100 text-stone-300' : 'bg-brand-50 text-brand-600'}`}>
                          <RouteIcon size={14} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-stone-800 truncate">
                            {t.origin.split(',').slice(0, 1).join('')} → {t.destination.split(',').slice(0, 1).join('')}
                          </div>
                          <div className="text-xs text-stone-400 mt-0.5">
                            {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                            {distFromDriver != null && (
                              <span className={`font-medium ${outOfRange ? 'text-stone-400' : 'text-brand-600'}`}>
                                {' '}
                                · à {distFromDriver.toFixed(1)} km{outOfRange ? ' (hors secteur)' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleClaim(t.id)}
                        loading={claimingId === t.id}
                        disabled={outOfRange}
                        title={outOfRange ? `Cette course est à plus de ${MAX_CLAIM_RADIUS_KM} km de votre position` : undefined}
                      >
                        Prendre
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
        </Reveal>
      </div>

      <Reveal variant="up" delay={150} className="grid lg:grid-cols-1 gap-6 mt-6">
        <Card padded={false} className="flex flex-col max-h-[60vh] transition-shadow duration-300 hover:shadow-floating">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
            <h2 className="font-semibold text-stone-800">Mes courses</h2>
            {!historyLoading && history.length > 0 && (
              <span className="text-xs font-medium text-stone-400">
                <span className="font-semibold text-stone-600">{filteredHistory.length}</span>
                {filteredHistory.length !== history.length ? `/ ${history.length}` : 'au total'}
              </span>
            )}
          </div>
          {!historyLoading && history.length > 0 && (
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
            {historyLoading ? (
              <ul className="divide-y divide-stone-100">
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
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 text-stone-400">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 mb-3">
                  <Inbox size={22} />
                </span>
                <p className="text-sm">Aucune course pour l'instant.</p>
                <p className="text-xs mt-1 max-w-xs">Votre historique de courses apparaîtra ici dès votre première course acceptée.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 text-stone-400">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 mb-3">
                  <SearchX size={22} />
                </span>
                <p className="text-sm">Aucune course ne correspond à ces filtres.</p>
                <button type="button" onClick={resetHistoryFilters} className="text-xs font-medium text-brand-600 hover:underline mt-1">
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {filteredHistory.map((t, i) => (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailTrip(t)}
                    onKeyDown={(e) => e.key === 'Enter' && setDetailTrip(t)}
                    className="group py-3 flex items-center justify-between gap-3 animate-fade-in-up transition-colors hover:bg-stone-50 -mx-2 px-2 rounded-lg cursor-pointer"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="grid place-items-center w-8 h-8 rounded-lg bg-stone-50 text-stone-400 shrink-0 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                        <ArrowRight size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-800 truncate">
                          {t.origin.split(',').slice(0, 1).join('')} → {t.destination.split(',').slice(0, 1).join('')}
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {formatDateTime(t.created_at)} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                        </div>
                      </div>
                    </div>
                    <Badge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </Reveal>

      <NewTripOfferModal offer={currentOffer} accepting={!!currentOffer && claimingId === currentOffer.id} onAccept={() => currentOffer && handleClaim(currentOffer.id)} onDecline={handleDeclineOffer} />
      <TripDetailModal trip={detailTrip} onClose={() => setDetailTrip(null)} viewerRole="CHAUFFEUR" />
      <ChauffeurDocumentsModal open={docsModalOpen} onClose={() => setDocsModalOpen(false)} onSubmitted={handleDocsSubmitted} />
    </div>
  )
}
