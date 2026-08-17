import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from '@/constants/config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokenStorage';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// In-memory cache so every request doesn't have to hit SecureStore.
let cachedAccessToken: string | null = null;

export function setAuthToken(token: string | null) {
  cachedAccessToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

/** Call once at app boot to restore the session from SecureStore. */
export async function hydrateAuthToken() {
  const token = await getAccessToken();
  if (token) setAuthToken(token);
  return token;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!cachedAccessToken) {
    const stored = await getAccessToken();
    if (stored) setAuthToken(stored);
  }
  return config;
});

let isRefreshing = false;
let queue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

function flushQueue(error: unknown, token: string | null) {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token as string)));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              originalRequest.headers = originalRequest.headers ?? ({} as never);
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refresh = await getRefreshToken();
        if (!refresh) throw error;
        const r = await axios.post(`${API_BASE}/auth/token/refresh/`, { refresh });
        const { access, refresh: newRefresh } = r.data;
        await saveTokens(access, newRefresh ?? refresh);
        setAuthToken(access);
        flushQueue(null, access);
        originalRequest.headers = originalRequest.headers ?? ({} as never);
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (e) {
        flushQueue(e, null);
        await clearTokens();
        setAuthToken(null);
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ---------- Auth ----------
export const sendOtp = (phone: string) => api.post('/auth/otp/send/', { phone });
export const verifyOtp = (phone: string, code: string) => api.post('/auth/otp/verify/', { phone, code });
export const registerUser = (payload: { username: string; phone: string; password: string; role: 'CLIENT' | 'CHAUFFEUR' }) =>
  api.post('/auth/register/', payload);
export const login = (phone: string, password: string) => api.post('/auth/token/', { phone, password });
export const refreshTokenCall = (refresh: string) => api.post('/auth/token/refresh/', { refresh });
export const getMe = () => api.get('/auth/me/');
export const updateMe = (payload: Record<string, unknown>) => api.patch('/auth/me/', payload);
export const logoutCall = (refresh: string) => api.post('/auth/logout/', { refresh });
export const deleteAccount = () => api.delete('/auth/me/');

// ---------- Chauffeurs ----------
export const applyChauffeur = (vehicle: { type: string; seats: number; plate_number: string }) =>
  api.post('/chauffeurs/apply/', { vehicle });
export const getAvailableChauffeurs = (params?: { lat?: number; lng?: number; radius?: number }) =>
  api.get('/chauffeurs/available/', { params });
export const updateLocation = (latitude: number, longitude: number) => api.post('/chauffeurs/location/', { latitude, longitude });
export const setChauffeurAvailability = (is_available: boolean) => api.post('/chauffeurs/availability/', { is_available });
export const getChauffeurRatingSummary = (id: number) => api.get(`/chauffeurs/${id}/rating-summary/`);
export const getMyChauffeurProfile = () => api.get('/chauffeurs/me/');
export const updateChauffeurPhoto = (photo: string | null) => api.post('/chauffeurs/photo/', { photo });

// ---------- Trips ----------
export const createTrip = (payload: {
  origin: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  dest_lat?: number;
  dest_lng?: number;
  mode?: string;
  vehicle_type?: string;
  distance_km?: number;
  payment_method?: string;
}) => api.post('/trips/create/', payload);
export const getAvailableTrips = () => api.get('/trips/available/');
export const claimTrip = (id: number) => api.post(`/trips/claim/${id}/`);
export const getMyTrips = () => api.get('/trips/my/');
export const getTripDetail = (id: number | string) => api.get(`/trips/${id}/`);
export const acceptTrip = (id: number | string) => api.post(`/trips/${id}/accept/`);
export const rejectTrip = (id: number | string) => api.post(`/trips/${id}/reject/`);
export const startTrip = (id: number | string) => api.post(`/trips/${id}/start/`);
export const endTrip = (id: number | string) => api.post(`/trips/${id}/end/`);
export const cancelTrip = (id: number | string) => api.post(`/trips/${id}/cancel/`);
export const rateTrip = (id: number | string, rating: number, comment?: string) => api.post(`/trips/${id}/rate/`, { rating, comment });
export const skipTripRating = (id: number | string) => api.post(`/trips/${id}/skip-rating/`);
export const shareTrip = (id: number | string) => api.post(`/trips/${id}/share/`);
export const triggerSos = (id: number | string, lat?: number, lng?: number) => api.post(`/trips/${id}/sos/`, { lat, lng });
export const updateTripVehicleType = (id: number | string, vehicle_type: string) => api.post(`/trips/${id}/vehicle-type/`, { vehicle_type });
export const updateTripPaymentMethod = (id: number | string, payment_method: string) => api.post(`/trips/${id}/payment-method/`, { payment_method });
export const getRewardsStatus = () => api.get('/trips/rewards/');

// ---------- Pricing ----------
export const estimatePrice = (payload: { distance_km: number; vehicle_type: string; mode?: string; region?: string }) =>
  api.post('/pricing/estimate/', payload);

// ---------- Clients ----------
export const getClientProfile = () => api.get('/clients/profile/');
export const updateClientProfile = (payload: Record<string, unknown>) => api.patch('/clients/profile/', payload);
export const createSupportTicket = (payload: { title: string; description: string; trip?: number }) =>
  api.post('/clients/tickets/', payload);
export const getClientPaymentMethods = () => api.get('/clients/payment-methods/');
export const saveDiscountCode = (code: string) => api.post('/clients/promo-code/', { code });

// ---------- Payments ----------
export const getTransactions = () => api.get('/payments/transactions/');
export const makePayment = (payload: { amount: number; currency?: string; method: string; status?: string; metadata?: Record<string, unknown> }) =>
  api.post('/payments/transactions/', { ...payload, status: 'PENDING' });
export const getPendingPaymentsForDriver = () => api.get('/payments/transactions/pending/driver/');
export const validateTransaction = (id: number) => api.post(`/payments/transactions/${id}/validate/`);
export const getPaymentsSummary = () => api.get('/payments/summary/');
export const getPaymentMethods = () => api.get('/payments/methods/');
export const addPaymentMethod = (payload: { provider: string; details?: Record<string, unknown>; is_default?: boolean }) =>
  api.post('/payments/methods/', payload);
export const deletePaymentMethod = (id: number) => api.delete(`/payments/methods/${id}/`);

export default api;
