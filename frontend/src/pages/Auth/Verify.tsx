import { useState } from 'react'
import { verifyOtp } from '../../lib/api'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Verify() {
  const loc = useLocation()
  const phone = (loc.state as any)?.phone || ''
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // verification will only mark phone as verified (no tokens)
      await verifyOtp(phone, code)
      // redirect to login (phone + password)
      navigate('/auth/login')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Code invalide')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Vérifier le code</h2>
        <p className="text-sm text-gray-600 mb-2">Code envoyé au: <strong>{phone}</strong></p>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Code (OTP)</label>
          <input className="w-full p-2 border rounded mb-4" value={code} onChange={(e) => setCode(e.target.value)} required />
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 bg-brand-blue-500 text-white rounded" disabled={loading}>
            {loading ? 'Vérification...' : 'Vérifier et continuer'}
          </button>
        </form>
      </div>
    </div>
  )
}
