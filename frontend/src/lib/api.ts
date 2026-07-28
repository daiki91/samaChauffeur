import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://samachauffeur.onrender.com/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

// OTP DISABLED — plus de vérification de numéro à l'inscription. Décommenter pour réactiver.
// export async function sendOtp(phone: string) {
//   return api.post('/auth/otp/send/', { phone })
// }
//
// export async function verifyOtp(phone: string, code: string) {
//   return api.post('/auth/otp/verify/', { phone, code })
// }

export async function login(phone: string, password: string) {
  return api.post('/auth/token/', { phone, password })
}

export async function refreshToken(refresh: string) {
  return api.post('/auth/token/refresh/', { refresh })
}

export async function getMe() {
  return api.get('/auth/me/')
}

export async function updateMe(payload: { username?: string; language?: 'fr' | 'wo' }) {
  return api.patch('/auth/me/', payload)
}

export async function getUsers() {
  return api.get('/auth/users/')
}

export async function createUser(payload: { username: string; phone: string; password: string; role?: string; language?: string }) {
  return api.post('/auth/users/', payload)
}

export async function getAdminChauffeurs() {
  return api.get('/chauffeurs/admin/chauffeurs/')
}

export async function getAdminVehicles() {
  return api.get('/chauffeurs/vehicles/')
}

export async function updateAdminChauffeur(id: number, payload: { is_verified?: boolean; is_available?: boolean; vehicle?: number | null }) {
  return api.patch(`/chauffeurs/admin/chauffeurs/${id}/`, payload)
}

export async function deleteAdminChauffeur(id: number) {
  return api.delete(`/chauffeurs/admin/chauffeurs/${id}/`)
}

/** Average rating + review count for a chauffeur — shown to the passenger before the ride. */
export async function getChauffeurRatingSummary(id: number) {
  return api.get(`/chauffeurs/${id}/rating-summary/`)
}

export async function getAdminTrips(limit = 200) {
  return api.get(`/trips/admin/all/?limit=${limit}`)
}

/** Reports the current user's device position — feeds the admin "last known location" map. */
export async function updateMyLocation(lat: number, lng: number) {
  return api.post('/auth/location/', { lat, lng })
}

/** Admin — every client/chauffeur with a known position: live if connected, last seen otherwise. */
export async function getUserLocations() {
  return api.get('/auth/users/locations/')
}

// Response interceptor to auto-refresh token on 401
let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    if (err.response && err.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
            return axios(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refresh = localStorage.getItem('refresh')
      if (!refresh) {
        isRefreshing = false
        return Promise.reject(err)
      }

      try {
        const r = await refreshToken(refresh)
        const newAccess = r.data.access
        const newRefresh = r.data.refresh
        localStorage.setItem('access', newAccess)
        localStorage.setItem('refresh', newRefresh)
        setAuthToken(newAccess)
        processQueue(null, newAccess)
        return api(originalRequest)
      } catch (e) {
        processQueue(e, null)
        // clear tokens
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        setAuthToken(null)
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  },
)

export async function getAvailableChauffeurs(params?: {lat?: number; lng?: number; radius?: number}) {
  const qs = new URLSearchParams()
  if (params?.lat !== undefined) qs.set('lat', String(params.lat))
  if (params?.lng !== undefined) qs.set('lng', String(params.lng))
  if (params?.radius !== undefined) qs.set('radius', String(params.radius))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`/chauffeurs/available/${suffix}`)
}

export async function getMyTrips() {
  return api.get('/trips/my/')
}

export async function createTrip(payload: {
  origin: string
  origin_lat?: number
  origin_lng?: number
  destination: string
  dest_lat?: number
  dest_lng?: number
  stops?: { label: string; lat?: number; lng?: number }[]
  mode?: string
  vehicle_type?: string
  distance_km?: number
  payment_method?: string
  scheduled_at?: string
  promo_code?: string
}) {
  return api.post('/trips/create/', payload)
}

export async function getTrip(id: number) {
  return api.get(`/trips/${id}/`)
}

export async function cancelTrip(id: number) {
  return api.post(`/trips/${id}/cancel/`)
}

export async function updateTripVehicleType(id: number, vehicle_type: string) {
  return api.post(`/trips/${id}/vehicle-type/`, { vehicle_type })
}

export async function rateTrip(id: number, rating: number, comment?: string) {
  return api.post(`/trips/${id}/rate/`, { rating, comment })
}

export async function skipTripRating(id: number) {
  return api.post(`/trips/${id}/skip-rating/`)
}

export async function shareTrip(id: number) {
  return api.post(`/trips/${id}/share/`)
}

/** Public — no auth, used by the read-only /share/trip/:token page. */
export async function getSharedTrip(token: string) {
  return api.get(`/trips/shared/${token}/`)
}

export async function triggerSos(id: number, lat?: number, lng?: number) {
  return api.post(`/trips/${id}/sos/`, { lat, lng })
}

export async function getAdminSosAlerts() {
  return api.get('/trips/admin/sos/')
}

export async function resolveSosAlert(id: number) {
  return api.post(`/trips/admin/sos/${id}/resolve/`)
}

export async function updateTripPaymentMethod(id: number, payment_method: string) {
  return api.post(`/trips/${id}/payment-method/`, { payment_method })
}

export async function deleteAccount() {
  return api.delete('/auth/me/')
}

export async function getAvailableTrips() {
  return api.get('/trips/available/')
}

export async function claimTrip(id: number) {
  return api.post(`/trips/claim/${id}/`)
}

export async function getTransactions() {
  return api.get('/payments/transactions/')
}

export async function makePayment(payload: { amount: number; currency?: string; method: string; status?: string; metadata?: any }) {
  // ensure payments are created with PENDING status client-side
  return api.post('/payments/transactions/', { ...payload, status: 'PENDING' })
}

export async function getPendingPaymentsForDriver() {
  return api.get('/payments/transactions/pending/driver/')
}

export async function validateTransaction(id: number) {
  return api.post(`/payments/transactions/${id}/validate/`)
}

export async function getPaymentsSummary() {
  return api.get('/payments/summary/')
}

export async function applyChauffeur(vehicle: { type: string; seats: number; plate_number: string }) {
  return api.post('/chauffeurs/apply/', { vehicle })
}

export async function verifyChauffeur(id: number) {
  return api.post(`/chauffeurs/verify/${id}/`)
}

export async function rejectChauffeur(id: number) {
  return api.post(`/chauffeurs/reject/${id}/`)
}

export async function estimatePrice(payload: { distance_km: number; vehicle_type: string; mode?: string; region?: string }) {
  return api.post('/pricing/estimate/', payload)
}

export async function getMyClientProfile() {
  return api.get('/clients/profile/')
}

export async function getRewardsStatus() {
  return api.get('/trips/rewards/')
}

export async function saveDiscountCode(code: string) {
  return api.post('/clients/promo-code/', { code })
}

export async function setChauffeurAvailability(is_available: boolean) {
  return api.post('/chauffeurs/availability/', { is_available })
}

export async function updateLocation(latitude: number, longitude: number) {
  return api.post('/chauffeurs/location/', { latitude, longitude })
}

export async function updateChauffeurPhoto(photo: string | null) {
  return api.post('/chauffeurs/photo/', { photo })
}

export async function getMyChauffeurProfile() {
  return api.get('/chauffeurs/me/')
}

export default api
