export type Point = { lat: number; lng: number }

export type ActiveTrip = {
  id: number
  status: string
  vehicle_type: string
  payment_method: string
  price: number | null
  distance_km: number | null
  origin: string
  origin_lat: number | null
  origin_lng: number | null
  destination: string
  dest_lat: number | null
  dest_lng: number | null
  stops?: { label: string; lat?: number; lng?: number }[]
  scheduled_at?: string | null
  deposit_amount?: number | null
  created_at: string
  driver_detail: {
    id: number
    username?: string
    phone?: string
    photo?: string | null
    vehicle: { type: string; plate_number: string; seats: number } | null
  } | null
  passenger_detail?: { id: number; username?: string; phone?: string } | null
  rating: { id: number; rating: number; comment: string | null; skipped: boolean; created_at: string } | null
}

export const VEHICLE_OPTIONS = [
  { value: 'CAR', label: 'Voiture' },
  { value: 'SEDAN', label: 'Berline' },
  { value: 'SUV', label: '4x4' },
  { value: 'MINIBUS', label: 'Minibus' },
  { value: 'BUS', label: 'Bus rapide' },
]

export const VEHICLE_LABELS: Record<string, string> = Object.fromEntries(VEHICLE_OPTIONS.map((o) => [o.value, o.label]))

export const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'ORANGE', label: 'Orange Money' },
]
