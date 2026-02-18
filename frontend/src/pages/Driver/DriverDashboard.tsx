import { useEffect, useState, useRef } from 'react'
import DriverMap from '../Map/DriverMap'
import { getAvailableTrips, claimTrip } from '../../lib/driverApi'
import { getPendingPaymentsForDriver, validateTransaction } from '../../lib/api'
import { useToasts } from '../../components/Toasts'

export default function DriverDashboard() {
  const [trips, setTrips] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableTrips()
        setTrips(r.data)
      } catch (e) {
        // ignore
      }
      try {
        const p = await getPendingPaymentsForDriver()
        setPendingPayments(p.data)
      } catch (e) {
        // ignore
      }
    }
    load()

    // listen to driver's group messages (trip.requested/trip.assigned)
    const token = localStorage.getItem('access')
    if (token) {
      const url = `ws://${window.location.hostname}:8000/ws/realtime/driver/?token=${token}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.addEventListener('open', () => console.log('Driver WS opened'))
      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'trip.requested') {
            setTrips((t) => [data, ...t])
            addToast({ message: `Nouvelle course: ${data.origin} → ${data.destination}`, tone: 'info' })
          }
          if (data.type === 'trip.assigned') {
            // remove from list if assigned to someone else
            setTrips((t) => t.filter(x => x.id !== data.trip_id))
          }
        } catch (e) {
          // ignore
        }
      })
    }

    return () => {
      wsRef.current?.close()
    }
  }, [])

  const handleClaim = async (id: number) => {
    try {
      await claimTrip(id)
      alert('Course claimée')
      setTrips((t) => t.filter((x) => x.id !== id))
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur')
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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Espace Chauffeur</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Carte (envoyer position)</h2>
          <DriverMap />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Courses disponibles</h2>
          <ul>
            {trips.map((t) => (
              <li key={t.id} className="py-2 border-b flex justify-between">
                <div>{t.origin} ➜ {t.destination} — {t.distance_km ?? '—'} km — {t.price ?? '—'} XOF</div>
                <button className="px-3 py-1 bg-brand-blue-500 text-white rounded" onClick={() => handleClaim(t.id)}>Claim</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Paiements en attente</h2>
          <ul>
            {pendingPayments.map((tx) => (
              <li key={tx.id} className="py-2 border-b flex justify-between">
                <div>Trip #{tx.metadata?.trip_id} — {tx.amount} {tx.currency} — <strong>{tx.status}</strong></div>
                <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => handleValidatePayment(tx.id)}>Valider paiement</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}