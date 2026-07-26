import api from './api'

export async function getAvailableTrips() {
  return api.get('/trips/available/')
}

export async function claimTrip(id: number) {
  return api.post(`/trips/claim/${id}/`)
}

/** The trip currently assigned to this driver (ASSIGNED/ACCEPTED/STARTED), or null. */
export async function getMyActiveTrip() {
  return api.get('/trips/my-active/')
}

export async function acceptTrip(id: number) {
  return api.post(`/trips/${id}/accept/`)
}

/** Driver signals the passenger is now in the vehicle — starts the actual course. */
export async function startTrip(id: number) {
  return api.post(`/trips/${id}/start/`)
}

/** Driver signals arrival at the destination — completes the trip. */
export async function endTrip(id: number) {
  return api.post(`/trips/${id}/end/`)
}

/** "Espace chauffeur" stats — distance/earnings/trip count for a chosen date range. */
export async function getDriverStats(from: string, to: string) {
  return api.get('/chauffeurs/stats/', { params: { from, to } })
}

/** Same period, rendered as a downloadable PDF (server-generated, streamed as a blob). */
export async function downloadDriverReport(from: string, to: string) {
  return api.get('/chauffeurs/stats/report.pdf', { params: { from, to }, responseType: 'blob' })
}

export default { getAvailableTrips, claimTrip, getMyActiveTrip, acceptTrip, startTrip, endTrip, getDriverStats, downloadDriverReport }