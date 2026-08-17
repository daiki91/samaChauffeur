/**
 * Runtime configuration. Values come from EXPO_PUBLIC_* env vars (see .env) with
 * production fallbacks so the app works even if the env file isn't present in a build.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://samachauffeur.onrender.com/api';
export const SOCKET_BASE = process.env.EXPO_PUBLIC_SOCKET_BASE ?? 'https://samachauffeur.onrender.com';
/** Base URL of the web app's public /share/trip/:token page. No safe production fallback to
 *  guess here — leave EXPO_PUBLIC_SHARE_BASE unset and the share action just omits the link. */
export const SHARE_BASE = process.env.EXPO_PUBLIC_SHARE_BASE ?? '';
export const EMERGENCY_PHONE = process.env.EXPO_PUBLIC_EMERGENCY_PHONE ?? '17';

export const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Voiture', icon: 'car-outline' },
  { value: 'SEDAN', label: 'Berline', icon: 'car-sport-outline' },
  { value: 'SUV', label: '4x4', icon: 'bus-outline' },
  { value: 'MINIBUS', label: 'Minibus', icon: 'subway-outline' },
  { value: 'BUS', label: 'Bus', icon: 'bus-outline' },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]['value'];

export const PAYMENT_METHODS = [
  { value: 'ORANGE', label: 'Orange Money', icon: 'phone-portrait-outline' },
  { value: 'WAVE', label: 'Wave', icon: 'wallet-outline' },
  { value: 'FREE', label: 'Free Money', icon: 'cash-outline' },
  { value: 'CASH', label: 'Espèces', icon: 'cash' },
  { value: 'CARD', label: 'Carte', icon: 'card-outline' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];
