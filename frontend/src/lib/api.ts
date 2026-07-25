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

export async function sendOtp(phone: string) {
  return api.post('/auth/otp/send/', { phone })
}

export async function verifyOtp(phone: string, code: string) {
  return api.post('/auth/otp/verify/', { phone, code })
}

export async function login(phone: string, password: string) {
  return api.post('/auth/token/', { phone, password })
}

export async function refreshToken(refresh: string) {
  return api.post('/auth/token/refresh/', { refresh })
}

export async function getMe() {
  return api.get('/auth/me/')
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

export async function createTrip(payload: { origin: string; origin_lat?: number; origin_lng?: number; destination: string; dest_lat?: number; dest_lng?: number; mode?: string }) {
  return api.post('/trips/create/', payload)
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

export async function estimatePrice(payload: { distance_km: number; vehicle_type: string; mode?: string; region?: string }) {
  return api.post('/pricing/estimate/', payload)
}

export async function setChauffeurAvailability(is_available: boolean) {
  return api.post('/chauffeurs/availability/', { is_available })
}

export async function updateLocation(latitude: number, longitude: number) {
  return api.post('/chauffeurs/location/', { latitude, longitude })
}

export default api
