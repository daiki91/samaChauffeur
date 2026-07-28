import { useState } from 'react'
import { applyChauffeur } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import { Car, CarFront, Truck, Bus, Hash, Users, ArrowRight } from 'lucide-react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Reveal from '../../components/ui/Reveal'

const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Voiture', icon: Car },
  { value: 'SEDAN', label: 'Berline', icon: CarFront },
  { value: 'SUV', label: '4x4', icon: Truck },
  { value: 'MINIBUS', label: 'Minibus', icon: Users },
  { value: 'BUS', label: 'Bus', icon: Bus },
]

export default function ChauffeurOnboard() {
  const [vehicle, setVehicle] = useState({ type: 'CAR', seats: 4, plate_number: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setVehicle((v) => ({ ...v, [name]: name === 'seats' ? Number(value) : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await applyChauffeur(vehicle)
      navigate('/driver-map')
    } catch (err: any) {
      setError(err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative max-w-lg mx-auto px-4 py-10">
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[28rem] h-64 rounded-full bg-brand-300/15 blur-3xl -z-10" />

      <Reveal variant="zoom">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-warm-gradient text-white mb-4 shadow-floating animate-float-slow">
            <Car size={28} />
          </span>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1 mb-3">
            <span className="grid place-items-center w-4 h-4 rounded-full bg-brand-500 text-white text-[10px]">1</span>
            Étape 1 sur 2 — Véhicule
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Devenez chauffeur</h1>
          <p className="text-sm text-stone-500 mt-1.5 max-w-sm mx-auto">Renseignez votre véhicule pour démarrer. Un admin vérifiera votre profil avant activation.</p>
        </div>
      </Reveal>

      <Reveal variant="up" delay={100}>
        <Card className="transition-shadow duration-300 hover:shadow-floating">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Type de véhicule</label>
              <div className="grid grid-cols-5 gap-2">
                {VEHICLE_TYPES.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVehicle((v) => ({ ...v, type: opt.value }))}
                    className={`animate-fade-in-up flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                      vehicle.type === opt.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 scale-105 shadow-card'
                        : 'border-stone-200 text-stone-500 hover:border-brand-200 hover:scale-105'
                    }`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <opt.icon size={18} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Nombre de sièges"
              name="seats"
              type="number"
              min={1}
              value={vehicle.seats}
              onChange={handleChange}
              icon={<Users size={16} />}
            />
            <Input
              label="Plaque d'immatriculation"
              name="plate_number"
              value={vehicle.plate_number}
              onChange={handleChange}
              placeholder="DK-1234-A"
              icon={<Hash size={16} />}
              required
            />

            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <Button type="submit" fullWidth size="lg" loading={loading} icon={!loading ? <ArrowRight size={16} /> : undefined}>
              Continuer
            </Button>
          </form>
        </Card>
      </Reveal>
    </div>
  )
}
