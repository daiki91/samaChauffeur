import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, UserRound, ShieldCheck, PhoneCall, Trash2, X, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { deleteAccount } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

const ROLE_LABELS: Record<string, string> = { CLIENT: 'Passager', CHAUFFEUR: 'Chauffeur', ADMIN: 'Admin' }

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || ''

export default function Account() {
  const { user, loading, logout } = useAuth()
  const { addToast } = useToasts()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth/login" replace />

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      addToast({ message: 'Compte supprimé.', tone: 'info' })
      logout()
      navigate('/')
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la suppression du compte', tone: 'error' })
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Mon compte</h1>
      <p className="text-stone-500 mb-6">Vos informations personnelles.</p>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="grid place-items-center w-12 h-12 rounded-full bg-brand-100 text-brand-700 font-semibold uppercase">
            {user.username?.slice(0, 2)}
          </span>
          <div>
            <div className="font-semibold text-stone-900">{user.username}</div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
              <ShieldCheck size={13} />
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-stone-600">
              <UserRound size={16} />
              Nom d'utilisateur
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
              {user.username}
              <Lock size={12} className="text-stone-400" />
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-stone-600">
              <Phone size={16} />
              Téléphone
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
              {user.phone}
              <Lock size={12} className="text-stone-400" />
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Le nom d'utilisateur et le téléphone ne sont pas modifiables — ils servent à vous identifier.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold text-stone-800 mb-3">Besoin d'aide ?</h2>
        <a href={`tel:${SUPPORT_PHONE}`}>
          <Button variant="outline" fullWidth icon={<PhoneCall size={16} />}>
            Appeler le support
          </Button>
        </a>
      </Card>

      <Card>
        <h2 className="font-semibold text-stone-800 mb-1">Zone de danger</h2>
        <p className="text-sm text-stone-500 mb-3">La suppression de votre compte est définitive et irréversible.</p>
        <Button variant="danger" fullWidth icon={<Trash2 size={16} />} onClick={() => setConfirming(true)}>
          Supprimer mon compte
        </Button>
      </Card>

      {confirming && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl shadow-floating w-full max-w-sm p-6 relative animate-fade-in-up">
            <button
              onClick={() => setConfirming(false)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-600"
              disabled={deleting}
            >
              <X size={18} />
            </button>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-red-50 text-red-600 mb-3">
              <Trash2 size={20} />
            </span>
            <h3 className="text-lg font-semibold text-stone-900">Supprimer définitivement le compte ?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Cette action est irréversible : vos courses et votre historique seront supprimés. Cette action ne peut pas être annulée.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                Annuler
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Oui, supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
