import { useEffect, useState } from 'react'
import DriverMap from '../Map/DriverMap'
import { getAvailableChauffeurs, getMyTrips, getTransactions, getPaymentsSummary, createTrip, makePayment } from '../../lib/api'
import PaymentModal from '../../components/PaymentModal'
import { useToasts } from '../../components/Toasts' 

export default function ClientDashboard() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [paymentsSummary, setPaymentsSummary] = useState<any | null>(null)
  const [modalTrip, setModalTrip] = useState<any | null>(null)
  const { addToast } = useToasts()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const r = await getAvailableChauffeurs()
        setDrivers(r.data)
      } catch (e) {
        // ignore
      }
      try {
        const t = await getMyTrips()
        setTrips(t.data)
      } catch (e) {
        // ignore
      }
      try {
        const p = await getTransactions()
        setTransactions(p.data)
      } catch (e) {
        // ignore
      }
      try {
        const s = await getPaymentsSummary()
        setPaymentsSummary(s.data)
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [])

  const requestTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!origin || !destination) return addToast({ message: 'Origine et destination requises', tone: 'error' })

    try {
      const resp = await createTrip({ origin, destination })
      if (resp.data.assigned_driver) {
        addToast({ message: `Course assignée au chauffeur ${resp.data.assigned_driver.phone}`, tone: 'success' })
      } else if (resp.data.note) {
        addToast({ message: resp.data.note, tone: 'info' })
      }
      // refresh lists
      const t = await getMyTrips()
      setTrips(t.data)
      const r = await getAvailableChauffeurs()
      setDrivers(r.data)
      setOrigin('')
      setDestination('')
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la demande de course', tone: 'error' })
    }
  }

  const payForTrip = async (trip: any) => {
    let amount = trip.price || 0
    if (!amount) {
      const resp = prompt('Entrer le montant à payer (XOF):', '')
      if (!resp) return
      amount = Number(resp)
      if (isNaN(amount) || amount <= 0) return alert('Montant invalide')
    }

    const method = prompt('Méthode de paiement (CASH, ORANGE, WAVE):', 'CASH') || 'CASH'

    try {
      const pay = await makePayment({ amount, currency: 'XOF', method, metadata: { trip_id: trip.id } })
      addToast({ message: 'Paiement enregistré. En attente de validation par le chauffeur.', tone: 'info' })
      // refresh
      const p = await getPaymentsSummary()
      setPaymentsSummary(p.data)
      const tx = await getTransactions()
      setTransactions(tx.data)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur paiement')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Tableau de bord</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Chauffeurs disponibles</h2>

          <form className="mb-3" onSubmit={requestTrip}>
            <div className="flex gap-2">
              <input className="flex-1 p-2 border rounded" placeholder="Origine" value={origin} onChange={(e) => setOrigin(e.target.value)} />
              <input className="flex-1 p-2 border rounded" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
              <button className="px-3 py-1 bg-brand-blue-500 text-white rounded">Demander</button>
            </div>
          </form>

          <DriverMap initialDrivers={drivers.map((d) => ({ lat: d.latitude, lng: d.longitude, driver_id: d.id }))} />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Historique des courses</h2>
          <ul>
            {trips.map((t) => (
              <li key={t.id} className="py-2 border-b flex justify-between items-center">
                <div>{t.origin} ➜ {t.destination} — <strong>{t.status}</strong></div>
                <div>
                  {t.status === 'COMPLETED' && (
                    <>
                      <button className="ml-2 px-3 py-1 bg-green-600 text-white rounded" onClick={() => setModalTrip(t)}>Payer</button>
                    </>
                  )}
                  {t.status === 'COMPLETED' && t.is_paid && (
                    <span className="ml-2 text-sm text-green-700">Paiement validé</span>
                  )}
                  {t.status === 'COMPLETED' && !t.is_paid && (
                    <span className="ml-2 text-sm text-yellow-600">En attente validation</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <h2 className="text-lg font-semibold mt-4 mb-2">Transactions</h2>
          <div className="mb-2">Total dépensé: <strong>{paymentsSummary ? paymentsSummary.total_spent : '—'}</strong></div>
          <ul>
            {transactions.map((tx) => (
              <li key={tx.id} className="py-2 border-b">{tx.amount} {tx.currency} — {tx.status}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}