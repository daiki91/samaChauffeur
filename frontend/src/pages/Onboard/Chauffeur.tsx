import { useState } from 'react'
import { applyChauffeur } from '../../lib/api'
import { useNavigate } from 'react-router-dom'

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
      // success -> navigate to map
      navigate('/map')
    } catch (err: any) {
      setError(err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Inscription Chauffeur</h2>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">Type de véhicule</label>
          <select name="type" value={vehicle.type} onChange={handleChange} className="w-full p-2 border rounded mb-2">
            <option value="CAR">Voiture</option>
            <option value="SEDAN">Berline</option>
            <option value="SUV">4x4</option>
            <option value="MINIBUS">Minibus</option>
            <option value="BUS">Bus</option>
          </select>

          <label className="block mb-2">Nombre de sièges</label>
          <input name="seats" type="number" min={1} value={vehicle.seats} onChange={handleChange} className="w-full p-2 border rounded mb-2" />

          <label className="block mb-2">Plaque</label>
          <input name="plate_number" value={vehicle.plate_number} onChange={handleChange} className="w-full p-2 border rounded mb-4" required />

          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 bg-brand-blue-500 text-white rounded" disabled={loading}>{loading ? 'Soumission...' : 'Soumettre la demande'}</button>
        </form>
      </div>
    </div>
  )
}
