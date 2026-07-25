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

export default { getAvailableTrips, claimTrip, getMyActiveTrip, acceptTrip, startTrip, endTrip }