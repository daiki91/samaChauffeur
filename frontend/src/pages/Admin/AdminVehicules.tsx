import { useEffect, useMemo, useState } from 'react'
import { getAdminVehicles } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { Search, Truck } from 'lucide-react'
import { VEHICLE_LABELS } from '../../lib/adminFormat'

type AdminVehicle = { id: number; type: string; seats: number; plate_number: string }

export default function AdminVehicules() {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    getAdminVehicles()
      .then((r) => active && setVehicles(r.data))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter((v) => v.plate_number.toLowerCase().includes(q) || (VEHICLE_LABELS[v.type] || v.type).toLowerCase().includes(q))
  }, [vehicles, query])

  return (
    <div className="max-w-4xl mx-auto">
      <AdminPageHeader
        title="Véhicules"
        description="Le parc de véhicules enregistré sur la plateforme."
        action={<Badge><Truck size={13} className="inline mr-1 -mt-0.5" />{vehicles.length}</Badge>}
      />

      <Card className="mb-4">
        <Input icon={<Search size={15} />} placeholder="Rechercher par type ou plaque…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>

      <Card padded={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Plaque</th>
                <th className="px-5 py-3 font-medium">Places</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-stone-400 py-8">
                    {query ? 'Aucun résultat.' : 'Aucun véhicule.'}
                  </td>
                </tr>
              )}
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3 font-medium text-stone-800">{VEHICLE_LABELS[v.type] || v.type}</td>
                  <td className="px-5 py-3 text-stone-600">{v.plate_number}</td>
                  <td className="px-5 py-3 text-stone-500">{v.seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
