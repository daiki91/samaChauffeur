import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, UserRound, ShieldCheck, PhoneCall, Trash2, X, Lock, Pencil, Check, Languages, Camera, Gift, Copy, Tag, Car, Star } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { deleteAccount, updateMe, getMyChauffeurProfile, updateChauffeurPhoto, getMyClientProfile, saveDiscountCode, getChauffeurRatingSummary } from '../../lib/api'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Reveal from '../../components/ui/Reveal'
import Modal from '../../components/ui/Modal'
import { getInitials, VEHICLE_LABELS } from '../../lib/format'

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

  const [driverPhoto, setDriverPhoto] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [pendingPromo, setPendingPromo] = useState<{ code: string; pct: number } | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)
  const [savingPromo, setSavingPromo] = useState(false)

  const [rating, setRating] = useState<{ average: number | null; count: number } | null>(null)
  const [vehicle, setVehicle] = useState<{ type: string; seats: number; plate_number: string } | null>(null)

  useEffect(() => {
    if (user?.role !== 'CHAUFFEUR') return
    getMyChauffeurProfile()
      .then((res) => {
        setDriverPhoto(res.data.photo || null)
        setVehicle(res.data.vehicle || null)
        getChauffeurRatingSummary(res.data.id)
          .then((r) => setRating(r.data))
          .catch(() => {})
      })
      .catch(() => addToast({ message: 'Impossible de charger votre profil chauffeur.', tone: 'error' }))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'CLIENT') return
    getMyClientProfile()
      .then((res) => {
        setReferralCode(res.data.referral_code || null)
        setPendingPromo(res.data.pending_promo_code ? { code: res.data.pending_promo_code, pct: res.data.pending_promo_discount_pct } : null)
      })
      .catch(() => addToast({ message: 'Impossible de charger votre code promo et votre code de parrainage.', tone: 'error' }))
  }, [user?.role])

  const handleSavePromo = async () => {
    const code = promoInput.trim()
    if (!code) return
    setSavingPromo(true)
    setPromoError(null)
    try {
      const r = await saveDiscountCode(code)
      if (r.data.valid) {
        setPendingPromo({ code: code.toUpperCase(), pct: r.data.discount_pct })
        setPromoInput('')
        addToast({ message: 'Code promo enregistré — il sera appliqué à votre prochaine course.', tone: 'success' })
      } else {
        setPromoError(r.data.detail || 'Code invalide')
      }
    } catch (e: any) {
      setPromoError(e?.response?.data?.detail || 'Erreur lors de la vérification du code')
    } finally {
      setSavingPromo(false)
    }
  }

  const copyReferralCode = async () => {
    if (!referralCode) return
    try {
      await navigator.clipboard.writeText(referralCode)
      addToast({ message: 'Code de parrainage copié !', tone: 'success' })
    } catch {
      addToast({ message: `Votre code : ${referralCode}`, tone: 'info' })
    }
  }

  const handlePhotoPick = () => photoInputRef.current?.click()

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast({ message: 'Choisissez un fichier image.', tone: 'error' })
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      addToast({ message: 'Image trop lourde (max 3 Mo).', tone: 'error' })
      return
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setUploadingPhoto(true)
    try {
      await updateChauffeurPhoto(dataUrl)
      setDriverPhoto(dataUrl)
      addToast({ message: 'Photo de profil mise à jour.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || "Erreur lors de l'envoi de la photo", tone: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }

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
      addToast({ message: "Nom d'utilisateur mis à jour.", tone: 'success' })
      setEditingUsername(false)
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || (Object.values(e?.response?.data?.username || {})[0] as any)?.[0] || 'Erreur lors de la mise à jour', tone: 'error' })
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
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 mb-4 transition-colors">
        <ArrowLeft size={16} />
        Retour
      </button>

      <Reveal variant="fade">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Mon compte</h1>
        <p className="text-stone-500 mb-6">Vos informations personnelles.</p>
      </Reveal>

      <Reveal variant="up">
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <div className="flex items-center gap-3 mb-5">
            {driverPhoto ? <img src={driverPhoto} alt={user.username} className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-white shadow-card" /> : <span className="grid place-items-center w-14 h-14 rounded-full bg-warm-gradient text-white font-bold uppercase text-lg shrink-0">{getInitials(user.username)}</span>}
            <div className="min-w-0">
              <div className="font-semibold text-stone-900 truncate">{user.username}</div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
                <ShieldCheck size={13} />
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-stone-600 shrink-0">
                  <UserRound size={16} />
                  Nom d'utilisateur
                </span>
                {!editingUsername ? (
                  <button onClick={startEditUsername} className="flex items-center gap-1.5 text-sm font-medium text-stone-800 hover:text-brand-600 transition-colors group">
                    {user.username}
                    <Pencil size={12} className="text-stone-400 group-hover:text-brand-500" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      aria-label="Nom d'utilisateur"
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
                      className="w-32 text-sm rounded-lg border border-stone-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                    />
                    <button onClick={saveUsername} disabled={savingUsername} className="grid place-items-center w-7 h-7 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
                      {savingUsername ? <Spinner size={13} className="!border-white/40 !border-t-white" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingUsername(false)} disabled={savingUsername} className="grid place-items-center w-7 h-7 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
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
          <p className="mt-3 text-xs text-stone-400">Le téléphone n'est pas modifiable — il sert à vous identifier.</p>
        </Card>
      </Reveal>

      <Reveal variant="up" delay={80}>
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
            <Languages size={16} className="text-brand-600" />
            Langue préférée
          </h2>
          <p className="text-xs text-stone-500 mb-3">Utilisée pour vos notifications et échanges avec le support.</p>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = (user.language || 'fr') === opt.value
              return (
                <button key={opt.value} type="button" disabled={savingLanguage} onClick={() => changeLanguage(opt.value)} className={`text-sm font-medium px-3.5 py-2 rounded-lg border transition-all duration-200 active:scale-95 ${active ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-card' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:scale-105'} disabled:opacity-50`}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Card>
      </Reveal>

      {user.role === 'CLIENT' && (
        <Reveal variant="up" delay={105}>
          <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
            <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
              <Tag size={16} className="text-brand-600" />
              Code promo
            </h2>
            <p className="text-xs text-stone-500 mb-3">Enregistrez un code une fois : il s'applique automatiquement à votre prochaine course.</p>
            {pendingPromo && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-dashed border-secondary-300 bg-secondary-50 px-4 py-3">
                <Tag size={16} className="text-secondary-600 shrink-0" />
                <span className="text-sm text-stone-700 truncate">
                  Code actif :{' '}
                  <span className="font-semibold text-secondary-700">
                    {pendingPromo.code} (-{pendingPromo.pct}%)
                  </span>
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <input
                  aria-label="Code promo"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase())
                    setPromoError(null)
                  }}
                  placeholder="Ex: SAMA10"
                  className="flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                />
                <Button type="button" variant="outline" size="sm" loading={savingPromo} onClick={handleSavePromo} disabled={!promoInput.trim()}>
                  {pendingPromo ? 'Remplacer' : 'Enregistrer'}
                </Button>
              </div>
              {promoError && (
                <p className="mt-1.5 text-xs flex items-center gap-1 text-red-500">
                  <X size={12} /> {promoError}
                </p>
              )}
            </div>
          </Card>
        </Reveal>
      )}

      {user.role === 'CLIENT' && referralCode && (
        <Reveal variant="up" delay={110}>
          <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
            <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
              <Gift size={16} className="text-brand-600" />
              Parrainage
            </h2>
            <p className="text-xs text-stone-500 mb-3">Partagez ce code : vos proches profitent de 10% de réduction sur leur première course.</p>
            <button onClick={copyReferralCode} className="w-full flex items-center justify-between rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 hover:bg-brand-100 transition-colors">
              <span className="font-mono font-bold text-brand-700 tracking-wider">{referralCode}</span>
              <Copy size={16} className="text-brand-500" />
            </button>
          </Card>
        </Reveal>
      )}

      {user.role === 'CHAUFFEUR' && (
        <Reveal variant="up" delay={110}>
          <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-stone-800 flex items-center gap-2">
                <Camera size={16} className="text-brand-600" />
                Photo de profil
              </h2>
              {rating && rating.count > 0 && (
                <span className="inline-flex items-center gap-1 bg-accent-300/15 text-accent-700 rounded-full px-2.5 py-1 text-xs font-semibold">
                  <Star size={12} fill="currentColor" />
                  {rating.average} ({rating.count})
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mb-3">Affichée aux passagers dès qu'un trajet vous est attribué.</p>
            <div className="flex items-center gap-4">
              {driverPhoto ? (
                <img src={driverPhoto} alt="Photo de profil" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-card shrink-0" />
              ) : (
                <span className="grid place-items-center w-16 h-16 rounded-full bg-stone-100 text-stone-400 shrink-0">
                  <UserRound size={26} />
                </span>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <Button variant="outline" size="sm" loading={uploadingPhoto} onClick={handlePhotoPick} icon={<Camera size={14} />}>
                {driverPhoto ? 'Changer la photo' : 'Ajouter une photo'}
              </Button>
            </div>
          </Card>
        </Reveal>
      )}

      {user.role === 'CHAUFFEUR' && (
        <Reveal variant="up" delay={125}>
          <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
            <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
              <Car size={16} className="text-brand-600" />
              Mon véhicule
            </h2>
            <p className="text-xs text-stone-500 mb-3">Vérifié par notre équipe — contactez le support pour toute correction.</p>

            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              {vehicle ? (
                <>
                  <div className="text-sm font-medium text-stone-800">
                    {VEHICLE_LABELS[vehicle.type] || vehicle.type} · {vehicle.seats} places
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 font-mono">{vehicle.plate_number}</div>
                </>
              ) : (
                <div className="text-sm text-stone-400">Aucun véhicule renseigné</div>
              )}
            </div>
          </Card>
        </Reveal>
      )}

      <Reveal variant="up" delay={140}>
        <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 mb-3">Besoin d'aide ?</h2>
          <a href={`tel:${SUPPORT_PHONE}`}>
            <Button variant="outline" fullWidth icon={<PhoneCall size={16} />}>
              Appeler le support
            </Button>
          </a>
        </Card>
      </Reveal>

      <Reveal variant="up" delay={200}>
        <Card className="transition-shadow duration-300 hover:shadow-floating">
          <h2 className="font-semibold text-stone-800 mb-1">Zone de danger</h2>
          <p className="text-sm text-stone-500 mb-3">La suppression de votre compte est définitive et irréversible.</p>
          <Button variant="danger" fullWidth icon={<Trash2 size={16} />} onClick={() => setConfirming(true)}>
            Supprimer mon compte
          </Button>
        </Card>
      </Reveal>

      <Modal open={confirming} onClose={() => setConfirming(false)} dismissible={!deleting} labelledBy="delete-account-title">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-red-50 text-red-600 mb-3">
          <Trash2 size={20} />
        </span>
        <h3 id="delete-account-title" className="text-lg font-semibold text-stone-900">
          Supprimer définitivement le compte ?
        </h3>
        <p className="text-sm text-stone-500 mb-5">Cette action est irréversible : vos courses et votre historique seront supprimés. Cette action ne peut pas être annulée.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Oui, supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  )
}
