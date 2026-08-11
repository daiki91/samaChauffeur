import { useEffect, useMemo, useState } from 'react'
import { getAdminPayouts, updatePayoutStatus } from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { useToasts } from '../../components/Toasts'
import { Search, Wallet } from 'lucide-react'
import { PAYOUT_STATUS_STYLE, formatDateTime } from '../../lib/adminFormat'
import type { PayoutStatus } from '../../lib/adminFormat'

type AdminPayout = {
  id: number
  chauffeur: number
  chauffeur_username?: string
  chauffeur_phone?: string
  amount: number
  status: PayoutStatus
  scheduled_at: string | null
  processed_at: string | null
}

type StatusFilter = 'ALL' | PayoutStatus

export default function AdminRetraits() {
  const { addToast } = useToasts()
  const [payouts, setPayouts] = useState<AdminPayout[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    getAdminPayouts()
      .then((r) => active && setPayouts(r.data))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return payouts.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false
      if (!q) return true
      return (p.chauffeur_username || '').toLowerCase().includes(q) || (p.chauffeur_phone || '').toLowerCase().includes(q)
    })
  }, [payouts, query, status])

  const handlePayoutStatus = async (id: number, next: 'PROCESSED' | 'FAILED') => {
    setProcessing(id)
    try {
      const r = await updatePayoutStatus(id, next)
      setPayouts((prev) => prev.map((p) => (p.id === id ? r.data : p)))
      addToast({ message: next === 'PROCESSED' ? 'Retrait marqué comme versé.' : 'Retrait marqué comme échoué.', tone: next === 'PROCESSED' ? 'success' : 'info' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la mise à jour du retrait', tone: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <AdminPageHeader
        title="Retraits"
        description="Demandes de retrait des chauffeurs."
        action={<Badge><Wallet size={13} className="inline mr-1 -mt-0.5" />{payouts.length}</Badge>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <Input icon={<Search size={15} />} placeholder="Rechercher par chauffeur…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-1">
          {(['ALL', 'SCHEDULED', 'PROCESSED', 'FAILED'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                status === s ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {s === 'ALL' ? 'Tous' : PAYOUT_STATUS_STYLE[s].label}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3 font-medium">Chauffeur</th>
                <th className="px-5 py-3 font-medium">Montant</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Demandé le</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-stone-400 py-8">
                    {query || status !== 'ALL' ? 'Aucun résultat.' : 'Aucune demande de retrait.'}
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    {p.chauffeur_username || `#${p.chauffeur}`}
                    {p.chauffeur_phone && <div className="text-xs text-stone-400 font-normal">{p.chauffeur_phone}</div>}
                  </td>
                  <td className="px-5 py-3 text-stone-600">{p.amount.toLocaleString('fr-FR')} XOF</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${PAYOUT_STATUS_STYLE[p.status].className}`}>{PAYOUT_STATUS_STYLE[p.status].label}</span>
                  </td>
                  <td className="px-5 py-3 text-stone-400 whitespace-nowrap">{p.scheduled_at ? formatDateTime(p.scheduled_at) : '—'}</td>
                  <td className="px-5 py-3">
                    {p.status === 'SCHEDULED' ? (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" loading={processing === p.id} onClick={() => handlePayoutStatus(p.id, 'PROCESSED')} icon={<Wallet size={13} />}>
                          Versé
                        </Button>
                        <Button size="sm" variant="danger" disabled={processing === p.id} onClick={() => handlePayoutStatus(p.id, 'FAILED')}>
                          Échoué
                        </Button>
                      </div>
                    ) : (
                      <span className="text-stone-300">—</span>
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
