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

/** Driver signals they've reached the pickup point, ahead of the passenger boarding. */
export async function arriveTrip(id: number) {
  return api.post(`/trips/${id}/arrived/`)
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

/** Lifetime earnings vs. already-claimed payouts — what's left the driver can withdraw. */
export async function getEarningsSummary() {
  return api.get('/payments/earnings/summary/')
}

/** The driver's own payout/withdrawal history. */
export async function getMyPayouts() {
  return api.get('/payments/payouts/me/')
}

/** Request a withdrawal of up to the available balance — starts out SCHEDULED until an admin processes it. */
export async function requestPayout(amount: number, method?: string) {
  return api.post('/payments/payouts/request/', { amount, method })
}

/** Every trip this driver has ever driven, newest first. */
export async function getDriverHistory() {
  return api.get('/trips/driver-history/')
}

/** Discreet in-ride SOS, triggered by the driver instead of the passenger. */
export async function triggerDriverSos(tripId: number, lat?: number, lng?: number) {
  return api.post(`/trips/${tripId}/sos/driver/`, { lat, lng })
}

export default {
  getAvailableTrips,
  claimTrip,
  getMyActiveTrip,
  acceptTrip,
  arriveTrip,
  startTrip,
  endTrip,
  getDriverStats,
  downloadDriverReport,
  getEarningsSummary,
  getMyPayouts,
  requestPayout,
  getDriverHistory,
  triggerDriverSos,
}