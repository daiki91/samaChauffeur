import React, { useEffect, useMemo, useState } from 'react'
import { getUsers, getAdminChauffeurs, getAdminVehicles, getAdminTrips, verifyChauffeur, rejectChauffeur } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import MiniBarChart from '../../components/admin/MiniBarChart'
import { useToasts } from '../../components/Toasts'
import { Users, Car, Truck, Route as RouteIcon, ShieldCheck, Activity, X, Check, Ban } from 'lucide-react'

type AdminUser = { id: number; username: string; phone: string; role: string; phone_verified: boolean }
type AdminChauffeur = {
  id: number
  user: number
  username?: string
  phone?: string
  is_verified: boolean
  is_available: boolean
  is_online: boolean
  vehicle: { id: number; type: string; seats: number; plate_number: string } | null
}
type AdminVehicle = { id: number; type: string; seats: number; plate_number: string }
type AdminTrip = {
  id: number
  origin: string
  destination: string
  status: string
  price: number | null
  distance_km: number | null
  vehicle_type: string
  payment_method: string
  created_at: string
  passenger_detail: { id: number; username: string; phone: string } | null
  driver_detail: { id: number; username?: string; phone?: string } | null
}

const VEHICLE_LABELS: Record<string, string> = { CAR: 'Voiture', SEDAN: 'Berline', SUV: '4x4', MINIBUS: 'Minibus', BUS: 'Bus' }
const PAYMENT_LABELS: Record<string, string> = { CASH: 'Espèces', ORANGE: 'Orange Money', WAVE: 'Wave', FREE: 'Free Money', CARD: 'Carte' }

const STATUS_ORDER = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED']
const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-accent-400',
  ASSIGNED: 'bg-brand-400',
  ACCEPTED: 'bg-brand-500',
  STARTED: 'bg-secondary-400',
  COMPLETED: 'bg-secondary-600',
  CANCELLED: 'bg-red-400',
}

type Tab = 'clients' | 'chauffeurs' | 'vehicules' | 'courses'

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-stone-900 leading-tight">{value}</div>
        <div className="text-xs text-stone-500 truncate">{label}</div>
      </div>
    </Card>
  )
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminOverview() {
  const { addToast } = useToasts()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [chauffeurs, setChauffeurs] = useState<AdminChauffeur[]>([])
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([])
  const [trips, setTrips] = useState<AdminTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('clients')
  const [reviewing, setReviewing] = useState<AdminChauffeur | null>(null)
  const [acting, setActing] = useState<'accept' | 'reject' | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [u, c, v, t] = await Promise.all([getUsers(), getAdminChauffeurs(), getAdminVehicles(), getAdminTrips()])
        if (!active) return
        setUsers(u.data)
        setChauffeurs(c.data)
        setVehicles(v.data)
        setTrips(t.data)
      } catch (e) {
        // ignore — sections just stay empty
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const clients = useMemo(() => users.filter((u) => u.role === 'CLIENT'), [users])

  const tripsByStatus = useMemo(
    () => STATUS_ORDER.map((status) => ({ label: status, value: trips.filter((t) => t.status === status).length, colorClass: STATUS_COLORS[status] })),
    [trips],
  )

  const last7Days = useMemo(() => {
    const days: { key: string; label: string; value: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ key, label: formatDateShort(d.toISOString()), value: 0 })
    }
    trips.forEach((t) => {
      const key = t.created_at.slice(0, 10)
      const day = days.find((d) => d.key === key)
      if (day) day.value += 1
    })
    return days.map((d) => ({ label: d.label, value: d.value }))
  }, [trips])

  const chauffeurStats = useMemo(
    () => [
      { label: 'Vérifiés', value: chauffeurs.filter((c) => c.is_verified).length, colorClass: 'bg-secondary-600' },
      { label: 'En attente', value: chauffeurs.filter((c) => !c.is_verified).length, colorClass: 'bg-accent-400' },
      { label: 'En ligne', value: chauffeurs.filter((c) => c.is_online).length, colorClass: 'bg-brand-500' },
    ],
    [chauffeurs],
  )

  const completedRevenue = useMemo(
    () => trips.filter((t) => t.status === 'COMPLETED' && t.price != null).reduce((sum, t) => sum + (t.price || 0), 0),
    [trips],
  )

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }

  const handleAccept = async () => {
    if (!reviewing) return
    setActing('accept')
    try {
      await verifyChauffeur(reviewing.id)
      setChauffeurs((prev) => prev.map((c) => (c.id === reviewing.id ? { ...c, is_verified: true } : c)))
      addToast({ message: 'Chauffeur vérifié.', tone: 'success' })
      setReviewing(null)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la vérification.', tone: 'error' })
    } finally {
      setActing(null)
    }
  }

  const handleReject = async () => {
    if (!reviewing) return
    setActing('reject')
    try {
      await rejectChauffeur(reviewing.id)
      setChauffeurs((prev) => prev.filter((c) => c.id !== reviewing.id))
      addToast({ message: 'Candidature refusée.', tone: 'info' })
      setReviewing(null)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors du refus.', tone: 'error' })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Vue d'ensemble</h1>
        <p className="text-stone-500 text-sm">Suivi global de la plateforme : clients, chauffeurs, véhicules et courses.</p>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} label="Clients" value={clients.length} />
        <StatCard icon={<Car size={20} />} label="Chauffeurs" value={chauffeurs.length} />
        <StatCard icon={<Truck size={20} />} label="Véhicules" value={vehicles.length} />
        <StatCard icon={<RouteIcon size={20} />} label="Courses" value={trips.length} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
            <Activity size={18} className="text-brand-600" />
            Courses par statut
          </h2>
          <MiniBarChart data={tripsByStatus} />
        </Card>

        <Card>
          <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
            <RouteIcon size={18} className="text-brand-600" />
            Activité — 7 derniers jours
          </h2>
          <MiniBarChart data={last7Days} />
        </Card>

        <Card>
          <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" />
            Chauffeurs
          </h2>
          <MiniBarChart data={chauffeurStats} />
          <div className="mt-4 pt-4 border-t border-stone-100 text-sm text-stone-500">
            Revenu (courses terminées) : <span className="font-semibold text-stone-800">{completedRevenue.toLocaleString('fr-FR')} XOF</span>
          </div>
        </Card>
      </div>

      {/* Lists */}
      <Card padded={false} className="flex flex-col max-h-[60vh]">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-stone-100">
          {([
            ['clients', `Clients (${clients.length})`],
            ['chauffeurs', `Chauffeurs (${chauffeurs.length})`],
            ['vehicules', `Véhicules (${vehicles.length})`],
            ['courses', `Courses (${trips.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === key ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {tab === 'clients' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-medium">Utilisateur</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Numéro vérifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-stone-400 py-8">Aucun client.</td>
                  </tr>
                )}
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-stone-800">{c.username}</td>
                    <td className="px-5 py-3 text-stone-500">{c.phone}</td>
                    <td className="px-5 py-3">
                      {c.phone_verified ? (
                        <span className="text-secondary-700 font-medium">Vérifié</span>
                      ) : (
                        <span className="text-stone-400">Non vérifié</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'chauffeurs' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-medium">Chauffeur</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Véhicule</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">En ligne</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {chauffeurs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-stone-400 py-8">Aucun chauffeur.</td>
                  </tr>
                )}
                {chauffeurs.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-stone-800">{c.username || `#${c.user}`}</td>
                    <td className="px-5 py-3 text-stone-500">{c.phone || '—'}</td>
                    <td className="px-5 py-3 text-stone-600">
                      {c.vehicle ? `${VEHICLE_LABELS[c.vehicle.type] || c.vehicle.type} · ${c.vehicle.plate_number}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {c.is_verified ? (
                        <span className="text-secondary-700 font-medium">Vérifié</span>
                      ) : (
                        <span className="text-accent-700 font-medium">En attente</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {c.is_online ? (
                        <span className="flex items-center gap-1.5 text-secondary-700 font-medium">
                          <span className="live-dot !w-2 !h-2" />
                          En ligne
                        </span>
                      ) : (
                        <span className="text-stone-400">Hors ligne</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!c.is_verified ? (
                        <Button size="sm" variant="outline" onClick={() => setReviewing(c)}>
                          Vérifier
                        </Button>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'vehicules' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Plaque</th>
                  <th className="px-5 py-3 font-medium">Places</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-stone-400 py-8">Aucun véhicule.</td>
                  </tr>
                )}
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-3 font-medium text-stone-800">{VEHICLE_LABELS[v.type] || v.type}</td>
                    <td className="px-5 py-3 text-stone-600">{v.plate_number}</td>
                    <td className="px-5 py-3 text-stone-500">{v.seats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'courses' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-medium">Trajet</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Chauffeur</th>
                  <th className="px-5 py-3 font-medium">Paiement</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-stone-400 py-8">Aucune course.</td>
                  </tr>
                )}
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 min-w-[200px]">
                      <div className="font-medium text-stone-800 truncate max-w-[220px]">
                        {t.origin} → {t.destination}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{t.passenger_detail?.username || '—'}</td>
                    <td className="px-5 py-3 text-stone-600">{t.driver_detail?.username || '—'}</td>
                    <td className="px-5 py-3 text-stone-500">{PAYMENT_LABELS[t.payment_method] || t.payment_method}</td>
                    <td className="px-5 py-3">
                      <Badge status={t.status} />
                    </td>
                    <td className="px-5 py-3 text-stone-400 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {reviewing && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl shadow-floating w-full max-w-sm p-6 relative animate-fade-in-up">
            <button
              onClick={() => setReviewing(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-600"
              disabled={acting !== null}
            >
              <X size={18} />
            </button>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 mb-3">
              <ShieldCheck size={20} />
            </span>
            <h3 className="text-lg font-semibold text-stone-900">Vérifier ce chauffeur</h3>
            <p className="text-sm text-stone-500 mb-4">Vérifiez ses informations avant de valider ou refuser sa candidature.</p>

            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500">Chauffeur</span>
                <span className="font-medium text-stone-800">{reviewing.username || `#${reviewing.user}`}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500">Téléphone</span>
                <span className="font-medium text-stone-800">{reviewing.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500">Véhicule</span>
                <span className="font-medium text-stone-800">
                  {reviewing.vehicle ? `${VEHICLE_LABELS[reviewing.vehicle.type] || reviewing.vehicle.type} · ${reviewing.vehicle.seats} places` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500">Plaque</span>
                <span className="font-medium text-stone-800">{reviewing.vehicle?.plate_number || '—'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="danger" icon={<Ban size={16} />} loading={acting === 'reject'} disabled={acting === 'accept'} onClick={handleReject}>
                Refuser
              </Button>
              <Button variant="primary" icon={<Check size={16} />} loading={acting === 'accept'} disabled={acting === 'reject'} onClick={handleAccept}>
                Accepter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
