import api from './api'

export async function getAvailableTrips() {
  return api.get('/trips/available/')
}

export async function claimTrip(id: number) {
  return api.post(`/trips/claim/${id}/`)
}

export default { getAvailableTrips, claimTrip }