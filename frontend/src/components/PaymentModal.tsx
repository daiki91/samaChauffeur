import React, { useEffect, useState } from 'react'
import { Wallet, Banknote, Smartphone, X } from 'lucide-react'
import Button from './ui/Button'
import Input from './ui/Input'

const METHODS = [
  { value: 'CASH', label: 'Espèces', icon: Banknote },
  { value: 'ORANGE', label: 'Orange Money', icon: Smartphone },
  { value: 'WAVE', label: 'Wave', icon: Smartphone },
]

export default function PaymentModal({
  visible,
  trip,
  onClose,
  onConfirm,
}: {
  visible: boolean
  trip?: any
  onClose: () => void
  onConfirm: (amount: number, method: string) => Promise<void>
}) {
  const [amount, setAmount] = useState<number>(0)
  const [method, setMethod] = useState<string>('CASH')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (trip) setAmount(trip.price || 0)
  }, [trip])

  if (!visible || !trip) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm(amount, method)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-floating w-full max-w-sm p-6 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute right-4 top-4 text-stone-400 hover:text-stone-600">
          <X size={18} />
        </button>
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-secondary-50 text-secondary-600 mb-3">
          <Wallet size={20} />
        </span>
        <h3 className="text-lg font-semibold text-stone-900">Payer la course</h3>
        <p className="text-sm text-stone-500 mb-4">
          {trip.origin} → {trip.destination}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Montant (XOF)" value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number" min={0} />

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Méthode</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-medium ${
                    method === m.value ? 'border-secondary-500 bg-secondary-50 text-secondary-700' : 'border-stone-200 text-stone-500'
                  }`}
                >
                  <m.icon size={16} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" variant="secondary" loading={loading}>
              Payer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
