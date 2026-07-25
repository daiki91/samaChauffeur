import { useEffect, useState, useRef } from 'react'
import DriverMap from '../Map/DriverMap'
import { getAvailableTrips, claimTrip } from '../../lib/driverApi'
import { getPendingPaymentsForDriver, validateTransaction, setChauffeurAvailability } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { MapPinned, Wallet, Power, Route as RouteIcon, MoonStar } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket } from '../../lib/socket'

export default function DriverDashboard() {
  const [trips, setTrips] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [online, setOnline] = useState(false)
  const [toggling, setToggling] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const { addToast } = useToasts()

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableTrips()
        setTrips(r.data)
      } catch (e) {}
      try {
        const p = await getPendingPaymentsForDriver()
        setPendingPayments(p.data)
      } catch (e) {}
    }
    load()
  }, [])

  useEffect(() => {
    if (!online) return

    const socket = connectDriverSocket()
    if (socket) {
      socketRef.current = socket
      socket.on('message', (data: any) => {
        if (data.type === 'trip.requested') {
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
  }, [online])

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

  const handleClaim = async (id: number) => {
    try {
      await claimTrip(id)
      addToast({ message: 'Course prise en charge', tone: 'success' })
      setTrips((t) => t.filter((x) => x.id !== id))
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    }
  }

  const handleValidatePayment = async (txId: number) => {
    try {
      await validateTransaction(txId)
      addToast({ message: 'Paiement validé', tone: 'success' })
      const p = await getPendingPaymentsForDriver()
      setPendingPayments(p.data)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur', tone: 'error' })
    }
  }

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
            <h2 className="font-semibold text-stone-800">Votre position en direct</h2>
          </div>
          {online ? (
            <DriverMap
              standalone={false}
              height="65vh"
              role="driver"
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
                    {t.origin.split(",").slice(0,1).join("")} → {t.destination.split(",").slice(0,1).join("")}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleClaim(t.id)}>
                  Prendre
                </Button>
              </li>
            ))}
          </ul>
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
                Course #{tx.metadata?.trip_id} — <span className="font-medium">{tx.amount} {tx.currency}</span>
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
