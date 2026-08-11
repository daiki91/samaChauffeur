import React, { useEffect, useState } from 'react'
import { Wallet, Banknote, Smartphone } from 'lucide-react'
import Button from './ui/Button'
import Input from './ui/Input'
import Modal from './ui/Modal'
import type { ActiveTrip } from './RideStatusBar'

const METHODS = [
  { value: 'CASH', label: 'Espèces', icon: Banknote },
  { value: 'ORANGE', label: 'Orange Money', icon: Smartphone },
  { value: 'WAVE', label: 'Wave', icon: Smartphone },
]

type Props = {
  visible: boolean
  trip?: ActiveTrip | null
  onClose: () => void
  onConfirm: (amount: number, method: string) => Promise<void>
}

export default function PaymentModal({ visible, trip, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState<number>(0)
  const [method, setMethod] = useState<string>('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (trip) setAmount(trip.price || 0)
    setError(null)
  }, [trip])

  if (!visible || !trip) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onConfirm(amount, method)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors du paiement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={visible} onClose={onClose} dismissible={!loading} bottomSheet labelledBy="payment-modal-title">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-secondary-50 text-secondary-600 mb-3">
        <Wallet size={20} />
      </span>
      <h3 id="payment-modal-title" className="text-lg font-semibold text-stone-900">
        Payer la course
      </h3>
      <p className="text-sm text-stone-500 mb-4">
        {trip.origin} → {trip.destination}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Montant (XOF)" value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number" min={0} autoFocus />

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Méthode</label>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Méthode de paiement">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(m.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-medium transition-all duration-200 active:scale-95 ${method === m.value ? 'border-secondary-500 bg-secondary-50 text-secondary-700 scale-105 shadow-card' : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:scale-105'}`}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="submit" variant="secondary" loading={loading} disabled={amount <= 0}>
            Payer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
