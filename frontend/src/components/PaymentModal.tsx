import React, { useEffect, useState } from 'react'

export default function PaymentModal({ visible, trip, onClose, onConfirm }: { visible: boolean; trip?: any; onClose: () => void; onConfirm: (amount: number, method: string) => Promise<void> }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-3">Payer la course</h3>
        <p className="text-sm text-gray-600 mb-3">Trip: {trip.origin} → {trip.destination}</p>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Montant (XOF)</label>
          <input className="w-full p-2 border rounded mb-3" value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number" min={0} />

          <label className="block mb-2">Méthode</label>
          <select className="w-full p-2 border rounded mb-4" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Espèces</option>
            <option value="ORANGE">Orange Money</option>
            <option value="WAVE">Wave</option>
          </select>

          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 border rounded" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="px-3 py-1 bg-brand-blue-500 text-white rounded" disabled={loading}>{loading ? 'En cours...' : 'Payer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
