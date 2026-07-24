import { useState } from 'react'
import api, { setAuthToken } from '../../lib/api'
import { saveTokens } from '../../lib/auth'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Phone, Lock } from 'lucide-react'
import AuthLayout from '../../components/ui/AuthLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function Login() {
  const loc = useLocation()
  const initialPhone = (loc.state as any)?.phone || ''
  const [form, setForm] = useState({ phone: initialPhone, password: '' })
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
      try {
        await (window as any).authRefresh?.()
      } catch (e) {}
      try {
        const me = await (await import('../../lib/api')).getMe()
        const role = me.data?.role
        if (role === 'CLIENT') navigate('/dashboard')
        else if (role === 'CHAUFFEUR') navigate('/driver-map')
        else navigate('/')
      } catch (e) {
        navigate('/')
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Content de vous revoir"
      subtitle="Connectez-vous pour réserver ou prendre le volant."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/auth/register" className="font-semibold text-brand-600">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Téléphone"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="+221 77 000 00 00"
          icon={<Phone size={16} />}
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="••••••••"
          icon={<Lock size={16} />}
          required
        />
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  )
}
