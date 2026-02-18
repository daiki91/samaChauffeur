import { useState } from 'react'
import api, { setAuthToken } from '../../lib/api'
import { saveTokens } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [form, setForm] = useState({ phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const resp = await api.post('/auth/token/', form)
      const { access, refresh } = resp.data
      saveTokens(access, refresh)
      setAuthToken(access)
      // refresh app-level user context if available
      try {
        await (window as any).authRefresh?.()
      } catch (e) {}
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Connexion</h2>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Téléphone</label>
          <input className="w-full p-2 border rounded mb-2" name="phone" value={form.phone} onChange={handleChange} placeholder="+221..." required />

          <label className="block mb-2">Mot de passe</label>
          <input type="password" className="w-full p-2 border rounded mb-4" name="password" value={form.password} onChange={handleChange} required />

          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 bg-brand-blue-500 text-white rounded" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        </form>
      </div>
    </div>
  )
}
