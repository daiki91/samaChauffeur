import { useState } from 'react'
import { applyChauffeur } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import { Car, CarFront, Truck, Bus, Hash, Users } from 'lucide-react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

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
      navigate('/map')
    } catch (err: any) {
      setError(err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="text-center mb-6">
        <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-warm-gradient text-white mb-3">
          <Car size={26} />
        </span>
        <h1 className="text-2xl font-bold text-stone-900">Devenir chauffeur</h1>
        <p className="text-sm text-stone-500 mt-1">Renseignez votre véhicule — un admin devra vérifier votre profil avant activation.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Type de véhicule</label>
            <div className="grid grid-cols-5 gap-2">
              {VEHICLE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVehicle((v) => ({ ...v, type: opt.value }))}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-[11px] font-medium transition-colors ${
                    vehicle.type === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
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
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Soumettre ma demande
          </Button>
        </form>
      </Card>
    </div>
  )
}
