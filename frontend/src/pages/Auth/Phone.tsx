import { useState } from 'react'
import { sendOtp } from '../../lib/api'
import { useNavigate } from 'react-router-dom'

export default function Phone() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // This page is used during registration to send verification OTP
      await sendOtp(phone)
      navigate('/auth/verify', { state: { phone } })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Vérifier le numéro (inscription)</h2>
        <p className="text-sm text-gray-600 mb-4">Entrez le numéro utilisé lors de l'inscription pour recevoir le code de vérification.</p>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Téléphone</label>
          <input
            className="w-full p-2 border rounded mb-4"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+221770..."
            required
          />
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 bg-brand-blue-500 text-white rounded" disabled={loading}>
            {loading ? 'Envoi...' : 'Envoyer le code'}
          </button>
        </form>
      </div>
    </div>
  )
}
