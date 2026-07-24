import { useState } from 'react'
import { sendOtp } from '../../lib/api'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Phone as PhoneIcon } from 'lucide-react'
import AuthLayout from '../../components/ui/AuthLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function Phone() {
  const loc = useLocation()
  const initialPhone = (loc.state as any)?.phone || ''
  const [phone, setPhone] = useState(initialPhone)
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
      setError(err?.response?.data?.detail || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Vérifier votre numéro" subtitle="Entrez le numéro utilisé lors de l'inscription pour recevoir le code de vérification.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+221 77 000 00 00"
          icon={<PhoneIcon size={16} />}
          required
        />
        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}{' '}
            {error === 'User not found. Register first.' && (
              <Link to="/auth/register" className="font-semibold underline">
                S'inscrire
              </Link>
            )}
          </div>
        )}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Envoyer le code
        </Button>
      </form>
    </AuthLayout>
  )
}
