import { useEffect, useMemo, useState } from 'react'
import { getUsers } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { Search, Users } from 'lucide-react'

type AdminUser = { id: number; username: string; phone: string; role: string; phone_verified: boolean }

export default function AdminClients() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    getUsers()
      .then((r) => active && setUsers(r.data))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const clients = useMemo(() => users.filter((u) => u.role === 'CLIENT'), [users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.username.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
  }, [clients, query])

  return (
    <div className="max-w-5xl mx-auto">
      <AdminPageHeader
        title="Clients"
        description="Tous les comptes passagers de la plateforme."
        action={<Badge><Users size={13} className="inline mr-1 -mt-0.5" />{clients.length}</Badge>}
      />

      <Card className="mb-4">
        <Input icon={<Search size={15} />} placeholder="Rechercher par nom ou téléphone…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-5 py-3 font-medium">Téléphone</th>
                <th className="px-5 py-3 font-medium">Numéro vérifié</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-stone-400 py-8">
                    {query ? 'Aucun résultat.' : 'Aucun client.'}
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
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
      </Card>
    </div>
  )
}
