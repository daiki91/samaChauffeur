import { useState } from 'react'
import { verifyOtp, setAuthToken } from '../../lib/api'
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
      const resp = await verifyOtp(phone, code)
      const access = resp.data.access
      const refresh = resp.data.refresh
      localStorage.setItem('access', access)
      localStorage.setItem('refresh', refresh)
      setAuthToken(access)

      // refresh user context
      try {
        await (window as any).authRefresh?.()
      } catch (e) {
        // ignore
      }

      // fetch user and redirect based on role
      try {
        const me = await (await import('../../lib/api')).getMe()
        const role = me.data?.role
        if (role === 'CLIENT') {
          navigate('/dashboard')
        } else if (role === 'CHAUFFEUR') {
          navigate('/driver-map')
        } else {
          navigate('/')
        }
      } catch (e) {
        navigate('/')
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid code')
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
            {loading ? 'Vérification...' : 'Vérifier & se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
