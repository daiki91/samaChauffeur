import { useState } from 'react'
import api from '../../lib/api'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [form, setForm] = useState({ username: '', phone: '', password: '', role: 'CLIENT' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/register/', form)
      navigate('/auth/phone')
    } catch (err: any) {
      setError(err?.response?.data || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Créer un compte</h2>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Nom d'utilisateur</label>
          <input className="w-full p-2 border rounded mb-2" name="username" value={form.username} onChange={handleChange} required />

          <label className="block mb-2">Téléphone</label>
          <input className="w-full p-2 border rounded mb-2" name="phone" value={form.phone} onChange={handleChange} required placeholder="+221..." />

          <label className="block mb-2">Mot de passe</label>
          <input type="password" className="w-full p-2 border rounded mb-2" name="password" value={form.password} onChange={handleChange} required minLength={6} />

          <label className="block mb-2">Rôle</label>
          <select className="w-full p-2 border rounded mb-4" name="role" value={form.role} onChange={handleChange}>
            <option value="CLIENT">Client</option>
            <option value="CHAUFFEUR">Chauffeur</option>
          </select>

          {error && <div className="text-red-600 mb-2">{JSON.stringify(error)}</div>}
          <button className="w-full py-2 bg-brand-blue-500 text-white rounded" disabled={loading}>{loading ? 'Création...' : 'Créer'}</button>
        </form>
      </div>
    </div>
  )
}
