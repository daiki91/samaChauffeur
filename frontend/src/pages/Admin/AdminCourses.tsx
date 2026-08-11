import { useEffect, useMemo, useState } from 'react'
import { getAdminTrips } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { Search, Route as RouteIcon } from 'lucide-react'
import { PAYMENT_LABELS, STATUS_ORDER, formatDateTime } from '../../lib/adminFormat'

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

type StatusFilter = 'ALL' | (typeof STATUS_ORDER)[number]

export default function AdminCourses() {
  const [trips, setTrips] = useState<AdminTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  useEffect(() => {
    let active = true
    getAdminTrips()
      .then((r) => active && setTrips(r.data))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return trips.filter((t) => {
      if (status !== 'ALL' && t.status !== status) return false
      if (!q) return true
      return (
        t.origin.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        (t.passenger_detail?.username || '').toLowerCase().includes(q) ||
        (t.driver_detail?.username || '').toLowerCase().includes(q)
      )
    })
  }, [trips, query, status])

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Courses"
        description="Historique des courses sur la plateforme."
        action={<Badge><RouteIcon size={13} className="inline mr-1 -mt-0.5" />{trips.length}</Badge>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <Input icon={<Search size={15} />} placeholder="Rechercher trajet, client ou chauffeur…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-1 overflow-x-auto">
          {(['ALL', ...STATUS_ORDER] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                status === s ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {s === 'ALL' ? 'Tous' : <Badge status={s} />}
            </button>
          ))}
        </div>
      </Card>

      <Card padded={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-stone-400 py-8">
                      {query || status !== 'ALL' ? 'Aucun résultat.' : 'Aucune course.'}
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
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
          </div>
        )}
      </Card>
    </div>
  )
}
