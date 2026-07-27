import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, UserRound, ShieldCheck, PhoneCall, Trash2, X, Lock, Pencil, Check, Languages } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { deleteAccount, updateMe } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Reveal from '../../components/ui/Reveal'

const ROLE_LABELS: Record<string, string> = { CLIENT: 'Passager', CHAUFFEUR: 'Chauffeur', ADMIN: 'Admin' }

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'wo', label: 'Wolof' },
]

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || ''

export default function Account() {
  const { user, loading, logout, refreshUser } = useAuth()
  const { addToast } = useToasts()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth/login" replace />

  const startEditUsername = () => {
    setUsernameDraft(user.username)
    setEditingUsername(true)
  }

  const saveUsername = async () => {
    const next = usernameDraft.trim()
    if (!next || next === user.username) {
      setEditingUsername(false)
      return
    }
    setSavingUsername(true)
    try {
      await updateMe({ username: next })
      await refreshUser()
      addToast({ message: 'Nom d\'utilisateur mis à jour.', tone: 'success' })
      setEditingUsername(false)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || (Object.values(e?.response?.data?.username || {})[0] as any)?.[0] || "Erreur lors de la mise à jour", tone: 'error' })
    } finally {
      setSavingUsername(false)
    }
  }

  const changeLanguage = async (language: string) => {
    if (language === (user.language || 'fr')) return
    setSavingLanguage(true)
    try {
      await updateMe({ language: language as 'fr' | 'wo' })
      await refreshUser()
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors du changement de langue', tone: 'error' })
    } finally {
      setSavingLanguage(false)
    }
  }

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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:text-stone-100 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <Reveal variant="fade">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50 mb-1">Mon compte</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6">Vos informations personnelles.</p>
      </Reveal>

      <Reveal variant="up">
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <div className="flex items-center gap-3 mb-5">
            <span className="grid place-items-center w-14 h-14 rounded-full bg-warm-gradient text-white font-bold uppercase text-lg shrink-0">
              {user.username?.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-stone-900 dark:text-stone-50 truncate">{user.username}</div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400">
                <ShieldCheck size={13} />
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 shrink-0">
                  <UserRound size={16} />
                  Nom d'utilisateur
                </span>
                {!editingUsername ? (
                  <button
                    onClick={startEditUsername}
                    className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-stone-100 hover:text-brand-600 transition-colors group"
                  >
                    {user.username}
                    <Pencil size={12} className="text-stone-400 dark:text-stone-500 group-hover:text-brand-500" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
                      className="w-32 text-sm rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                    />
                    <button
                      onClick={saveUsername}
                      disabled={savingUsername}
                      className="grid place-items-center w-7 h-7 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {savingUsername ? <Spinner size={13} className="!border-white/40 !border-t-white" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditingUsername(false)}
                      disabled={savingUsername}
                      className="grid place-items-center w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <Phone size={16} />
                Téléphone
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-stone-100">
                {user.phone}
                <Lock size={12} className="text-stone-400 dark:text-stone-500" />
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">Le téléphone n'est pas modifiable — il sert à vous identifier.</p>
        </Card>
      </Reveal>

      <Reveal variant="up" delay={80}>
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-1 flex items-center gap-2">
            <Languages size={16} className="text-brand-600" />
            Langue préférée
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">Utilisée pour vos notifications et échanges avec le support.</p>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = (user.language || 'fr') === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingLanguage}
                  onClick={() => changeLanguage(opt.value)}
                  className={`text-sm font-medium px-3.5 py-2 rounded-lg border transition-all duration-200 active:scale-95 ${
                    active ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-card' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:scale-105'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Card>
      </Reveal>

      <Reveal variant="up" delay={140}>
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-3">Besoin d'aide ?</h2>
          <a href={`tel:${SUPPORT_PHONE}`}>
            <Button variant="outline" fullWidth icon={<PhoneCall size={16} />}>
              Appeler le support
            </Button>
          </a>
        </Card>
      </Reveal>

      <Reveal variant="up" delay={200}>
        <Card className="transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-1">Zone de danger</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">La suppression de votre compte est définitive et irréversible.</p>
          <Button variant="danger" fullWidth icon={<Trash2 size={16} />} onClick={() => setConfirming(true)}>
            Supprimer mon compte
          </Button>
        </Card>
      </Reveal>

      {confirming && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-floating w-full max-w-sm p-6 relative animate-fade-in-up">
            <button
              onClick={() => setConfirming(false)}
              className="absolute right-4 top-4 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:text-stone-300"
              disabled={deleting}
            >
              <X size={18} />
            </button>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 mb-3">
              <Trash2 size={20} />
            </span>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Supprimer définitivement le compte ?</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
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
