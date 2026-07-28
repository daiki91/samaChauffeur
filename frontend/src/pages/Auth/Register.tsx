import { useState } from 'react'
import api from '../../lib/api'
import { useNavigate, Link } from 'react-router-dom'
import { User, Phone, Lock, Car, UserRound } from 'lucide-react'
import AuthLayout from '../../components/ui/AuthLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

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
      // OTP bypassed for local dev — go directly to login
      navigate('/auth/login', { state: { phone: form.phone } })
    } catch (err: any) {
      const data = err?.response?.data
      setError(typeof data === 'string' ? data : data?.detail || (Object.values(data?.fieldErrors || {})[0] as any)?.[0] || 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez samaChauffeur en moins d'une minute."
      footer={
        <>
          Déjà inscrit ?{''}
          <Link to="/auth/login" className="font-semibold text-brand-600">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom d'utilisateur" name="username" value={form.username} onChange={handleChange} icon={<User size={16} />} required />
        <Input label="Téléphone" name="phone" value={form.phone} onChange={handleChange} placeholder="+221 77 000 00 00" icon={<Phone size={16} />} required />
        <Input label="Mot de passe" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Au moins 6 caractères" icon={<Lock size={16} />} minLength={6} required />

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Je suis...</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'CLIENT', label: 'Passager', icon: UserRound },
              { value: 'CHAUFFEUR', label: 'Chauffeur', icon: Car },
            ].map((opt) => (
              <button key={opt.value} type="button" onClick={() => setForm({ ...form, role: opt.value })} className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-colors ${form.role === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                <opt.icon size={18} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  )
}
