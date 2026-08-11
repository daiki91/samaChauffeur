import { useRef, useState } from 'react'
import { FileText, ShieldCheck, Upload, Check } from 'lucide-react'
import { updateChauffeurDocuments } from '../lib/api'
import Button from './ui/Button'
import Modal from './ui/Modal'

const MAX_SIZE_BYTES = 5 * 1024 * 1024

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type SlotProps = {
  label: string
  hint: string
  icon: React.ReactNode
  value: string | null
  onChange: (dataUrl: string) => void
}

function DocumentSlot({ label, hint, icon, value, onChange }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Choisissez une image ou un PDF.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Fichier trop lourd (max 5 Mo).')
      return
    }
    onChange(await fileToDataUrl(file))
  }

  return (
    <div className={`rounded-xl border px-4 py-3.5 transition-colors duration-300 ${value ? 'border-secondary-200 bg-secondary-50/50' : 'border-stone-100 bg-stone-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`grid place-items-center w-9 h-9 rounded-lg shrink-0 transition-all duration-300 ${value ? 'bg-secondary-100 text-secondary-700 scale-105' : 'bg-white text-stone-400 border border-stone-200'}`}>
            {value ? <Check size={16} className="animate-pop" /> : icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-stone-800">{label}</div>
            <div className="text-xs text-stone-400">{value ? 'Fichier ajouté' : hint}</div>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleChange} />
        <Button type="button" variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => inputRef.current?.click()}>
          {value ? 'Changer' : 'Ajouter'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

// Shown automatically the moment a driver with an incomplete file lands on their dashboard —
// deliberately not a settings-page form, since a "go complete your profile somewhere in
// account" flow is easy to skip past and forget.
export default function ChauffeurDocumentsModal({ open, onClose, onSubmitted }: Props) {
  const [permit, setPermit] = useState<string | null>(null)
  const [insurance, setInsurance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const canSubmit = !!permit && !!insurance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await updateChauffeurDocuments(permit, insurance)
      onSubmitted()
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Erreur lors de l'envoi des documents")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!loading} bottomSheet maxWidth="max-w-md" labelledBy="docs-modal-title" className="max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-5">
        <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-warm-gradient text-white mb-3 shadow-card">
          <ShieldCheck size={26} />
        </span>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1 mb-2.5">
          <span className="grid place-items-center w-4 h-4 rounded-full bg-brand-500 text-white text-[10px]">2</span>
          Étape 2 sur 2 — Dossier
        </div>
        <h2 id="docs-modal-title" className="text-xl font-bold text-stone-900">
          Complétez votre dossier
        </h2>
        <p className="text-sm text-stone-500 mt-1">Dernière étape : ajoutez vos documents pour qu'un admin puisse activer votre compte.</p>
      </div>

      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mb-5">
        <div
          className="h-full bg-secondary-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((permit ? 1 : 0) + (insurance ? 1 : 0)) * 50}%` }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <DocumentSlot label="Permis de conduire" hint="Photo ou scan lisible" icon={<FileText size={16} />} value={permit} onChange={setPermit} />
        <DocumentSlot label="Assurance du véhicule" hint="Attestation en cours de validité" icon={<ShieldCheck size={16} />} value={insurance} onChange={setInsurance} />

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <Button type="submit" fullWidth size="lg" loading={loading} disabled={!canSubmit}>
          Envoyer mon dossier
        </Button>
        <button type="button" onClick={onClose} disabled={loading} className="w-full text-center text-xs text-stone-400 hover:text-stone-600 py-1 disabled:opacity-50">
          Plus tard
        </button>
      </form>
    </Modal>
  )
}
