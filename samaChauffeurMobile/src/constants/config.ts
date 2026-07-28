/**
 * Runtime configuration. Values come from EXPO_PUBLIC_* env vars (see .env) with
 * production fallbacks so the app works even if the env file isn't present in a build.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://samachauffeur.onrender.com/api';
export const SOCKET_BASE = process.env.EXPO_PUBLIC_SOCKET_BASE ?? 'https://samachauffeur.onrender.com';

export const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Voiture' },
  { value: 'SEDAN', label: 'Berline' },
  { value: 'SUV', label: '4x4' },
  { value: 'MINIBUS', label: 'Minibus' },
  { value: 'BUS', label: 'Bus' },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]['value'];
