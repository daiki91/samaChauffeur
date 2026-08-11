import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, getAdminChauffeurs, getAdminVehicles, getAdminTrips, getAdminPayouts } from '../../lib/api'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import MiniBarChart from '../../components/admin/MiniBarChart'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { Users, Car, Truck, Route as RouteIcon, ShieldCheck, Activity, Wallet, CalendarClock, ChevronRight } from 'lucide-react'
import { STATUS_ORDER, STATUS_COLORS, formatDateShort } from '../../lib/adminFormat'

type AdminUser = { id: number; username: string; phone: string; role: string; phone_verified: boolean }
type AdminChauffeur = { id: number; is_verified: boolean; is_available: boolean; is_online: boolean }
type AdminVehicle = { id: number }
type AdminPayout = { id: number; status: 'SCHEDULED' | 'PROCESSED' | 'FAILED' }
type AdminTrip = { id: number; status: string; price: number | null; created_at: string }

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number | string; to?: string }) {
  const content = (
    <Card className="flex items-center gap-3 h-full">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-stone-900 leading-tight">{value}</div>
        <div className="text-xs text-stone-500 truncate">{label}</div>
      </div>
      {to && <ChevronRight size={16} className="text-stone-300 shrink-0" />}
    </Card>
  )
  return to ? (
    <Link to={to} className="block hover:-translate-y-0.5 transition-transform">
      {content}
    </Link>
  ) : (
    content
  )
}

export default function AdminOverview() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [chauffeurs, setChauffeurs] = useState<AdminChauffeur[]>([])
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([])
  const [trips, setTrips] = useState<AdminTrip[]>([])
  const [payouts, setPayouts] = useState<AdminPayout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([getUsers(), getAdminChauffeurs(), getAdminVehicles(), getAdminTrips(), getAdminPayouts()])
      .then(([u, c, v, t, p]) => {
        if (!active) return
        setUsers(u.data)
        setChauffeurs(c.data)
        setVehicles(v.data)
        setTrips(t.data)
        setPayouts(p.data)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const clients = useMemo(() => users.filter((u) => u.role === 'CLIENT'), [users])
  const onlineChauffeurs = useMemo(() => chauffeurs.filter((c) => c.is_online).length, [chauffeurs])
  const pendingPayouts = useMemo(() => payouts.filter((p) => p.status === 'SCHEDULED').length, [payouts])

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return trips.filter((t) => t.created_at.slice(0, 10) === today).length
  }, [trips])

  const completedRevenue = useMemo(
    () => trips.filter((t) => t.status === 'COMPLETED' && t.price != null).reduce((sum, t) => sum + (t.price || 0), 0),
    [trips],
  )

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

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <AdminPageHeader title="Vue d'ensemble" description="Suivi global de la plateforme : clients, chauffeurs, véhicules et courses." />

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} label="Clients" value={clients.length} to="/admin/clients" />
        <StatCard icon={<Car size={20} />} label="Chauffeurs" value={chauffeurs.length} to="/admin/chauffeurs" />
        <StatCard icon={<Truck size={20} />} label="Véhicules" value={vehicles.length} to="/admin/vehicules" />
        <StatCard icon={<RouteIcon size={20} />} label="Courses" value={trips.length} to="/admin/courses" />
        <StatCard icon={<Activity size={20} />} label="Chauffeurs en ligne" value={onlineChauffeurs} to="/admin/users" />
        <StatCard icon={<CalendarClock size={20} />} label="Courses aujourd'hui" value={todayCount} to="/admin/courses" />
        <StatCard icon={<Wallet size={20} />} label="Retraits en attente" value={pendingPayouts} to="/admin/retraits" />
        <StatCard icon={<Wallet size={20} />} label="Revenu (courses terminées)" value={`${completedRevenue.toLocaleString('fr-FR')} XOF`} />
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
        </Card>
      </div>
    </div>
  )
}
