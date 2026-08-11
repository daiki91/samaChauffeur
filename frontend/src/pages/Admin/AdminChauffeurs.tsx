import { useEffect, useMemo, useState } from 'react'
import {
  getAdminChauffeurs,
  getAdminVehicles,
  updateAdminChauffeur,
  deleteAdminChauffeur,
  verifyChauffeur,
  rejectChauffeur,
} from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { useToasts } from '../../components/Toasts'
import { Search, Car, Ban, Play, Trash2, X, ShieldCheck, Check, FileText } from 'lucide-react'
import { VEHICLE_LABELS } from '../../lib/adminFormat'

type AdminChauffeur = {
  id: number
  user: number
  username?: string
  phone?: string
  is_verified: boolean
  is_available: boolean
  is_online: boolean
  vehicle: { id: number; type: string; seats: number; plate_number: string } | null
  permit?: string | null
  insurance?: string | null
}
type AdminVehicle = { id: number; type: string; seats: number; plate_number: string }

export default function AdminChauffeurs() {
  const { addToast } = useToasts()
  const [chauffeurs, setChauffeurs] = useState<AdminChauffeur[]>([])
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actionId, setActionId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<AdminChauffeur | null>(null)
  const [acting, setActing] = useState<'accept' | 'reject' | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getAdminChauffeurs(), getAdminVehicles()])
      .then(([c, v]) => {
        if (!active) return
        setChauffeurs(c.data)
        setVehicles(v.data)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chauffeurs
    return chauffeurs.filter((c) => (c.username || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q))
  }, [chauffeurs, query])

  async function handleToggleAvailable(c: AdminChauffeur) {
    setActionId(c.id)
    setActionError(null)
    try {
      const res = await updateAdminChauffeur(c.id, { is_available: !c.is_available })
      setChauffeurs((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...res.data } : x)))
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || 'Action impossible.')
    } finally {
      setActionId(null)
    }
  }

  async function handleAssignVehicle(c: AdminChauffeur, vehicleId: string) {
    setActionId(c.id)
    setActionError(null)
    try {
      const res = await updateAdminChauffeur(c.id, { vehicle: vehicleId ? Number(vehicleId) : null })
      setChauffeurs((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...res.data } : x)))
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || 'Action impossible.')
    } finally {
      setActionId(null)
    }
  }

  async function handleDeleteChauffeur(c: AdminChauffeur) {
    if (!window.confirm(`Retirer le statut chauffeur de ${c.username || `#${c.user}`} ? Le compte redevient un compte passager.`)) return
    setActionId(c.id)
    setActionError(null)
    try {
      await deleteAdminChauffeur(c.id)
      setChauffeurs((prev) => prev.filter((x) => x.id !== c.id))
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || 'Suppression impossible.')
    } finally {
      setActionId(null)
    }
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
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Chauffeurs"
        description="Vérification, disponibilité et affectation de véhicule."
        action={<Badge><Car size={13} className="inline mr-1 -mt-0.5" />{chauffeurs.length}</Badge>}
      />

      <Card className="mb-4">
        <Input icon={<Search size={15} />} placeholder="Rechercher par nom ou téléphone…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>

      {actionError && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{actionError}</div>}

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
                <th className="px-5 py-3 font-medium">Téléphone</th>
                <th className="px-5 py-3 font-medium">Véhicule</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">En ligne</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-stone-400 py-8">
                    {query ? 'Aucun résultat.' : 'Aucun chauffeur.'}
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const busy = actionId === c.id
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-stone-800">{c.username || `#${c.user}`}</td>
                    <td className="px-5 py-3 text-stone-500">{c.phone || '—'}</td>
                    <td className="px-5 py-3 text-stone-600">
                      <select
                        value={c.vehicle?.id ?? ''}
                        disabled={busy}
                        onChange={(e) => handleAssignVehicle(c, e.target.value)}
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 disabled:opacity-50"
                      >
                        <option value="">Aucun véhicule</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {VEHICLE_LABELS[v.type] || v.type} · {v.plate_number}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        {c.is_verified ? (
                          <span className="text-secondary-700 font-medium">Vérifié</span>
                        ) : (
                          <span className="text-accent-700 font-medium">En attente</span>
                        )}
                        {!c.is_available && <span className="text-red-600 text-xs font-medium">Suspendu</span>}
                      </div>
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
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setReviewing(c)}>
                          Examiner
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={c.is_available ? 'outline' : 'secondary'}
                            disabled={busy}
                            onClick={() => handleToggleAvailable(c)}
                            title={c.is_available ? 'Suspendre ce chauffeur' : 'Réactiver ce chauffeur'}
                          >
                            {c.is_available ? <Ban size={14} /> : <Play size={14} />}
                          </Button>
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => handleDeleteChauffeur(c)} title="Retirer le statut chauffeur">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {reviewing && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl shadow-floating w-full max-w-sm p-6 relative animate-fade-in-up">
            <button onClick={() => setReviewing(null)} className="absolute right-4 top-4 text-stone-400 hover:text-stone-600" disabled={acting !== null}>
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
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <FileText size={13} />
                  Permis
                </span>
                {reviewing.permit ? (
                  <a href={reviewing.permit} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                    Voir le document
                  </a>
                ) : (
                  <span className="text-stone-300">Non fourni</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <FileText size={13} />
                  Assurance
                </span>
                {reviewing.insurance ? (
                  <a href={reviewing.insurance} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                    Voir le document
                  </a>
                ) : (
                  <span className="text-stone-300">Non fourni</span>
                )}
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
