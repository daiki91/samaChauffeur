import { useState } from 'react'
import { verifyOtp } from '../../lib/api'
import { useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/ui/AuthLayout'
import Button from '../../components/ui/Button'

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
      // redirect to login (phone + password), pre-filling the phone we just verified
      navigate('/auth/login', { state: { phone } })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Code invalide')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Vérifiez votre code"
      subtitle={
        <>
          Code envoyé au <strong className="text-stone-700">{phone}</strong>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3.5 text-center text-2xl font-semibold tracking-[0.5em] text-stone-900 outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="——————"
          inputMode="numeric"
          maxLength={6}
          required
        />
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Vérifier et continuer
        </Button>
      </form>
    </AuthLayout>
  )
}
