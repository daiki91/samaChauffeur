export type Role = 'CLIENT' | 'CHAUFFEUR' | 'ADMIN';
export type Language = 'fr' | 'wo';
export type VehicleType = 'CAR' | 'SEDAN' | 'SUV' | 'MINIBUS' | 'BUS';
export type TripMode = 'PRIVATE' | 'SHARED' | 'BUS';
export type TripStatus = 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type TransactionMethod = 'ORANGE' | 'WAVE' | 'FREE' | 'CASH' | 'CARD';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type User = {
  id: number;
  username: string;
  phone: string;
  role: Role;
  language: Language;
  phone_verified: boolean;
};

export type Vehicle = {
  id: number;
  type: VehicleType;
  seats: number;
  plate_number: string;
};

export type Chauffeur = {
  id: number;
  user: number;
  vehicle: Vehicle | null;
  is_verified: boolean;
  is_available: boolean;
};

export type AvailableChauffeur = {
  id: number;
  phone: string;
  username: string;
  vehicle: Vehicle | null;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type Trip = {
  id: number;
  passenger: number;
  driver: number | null;
  origin: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination: string;
  dest_lat: number | null;
  dest_lng: number | null;
  distance_km: number | null;
  estimated_duration: number | null;
  mode: TripMode;
  price: number | null;
  status: TripStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Transaction = {
  id: number;
  client: number | null;
  amount: number;
  currency: string;
  method: TransactionMethod;
  status: TransactionStatus;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PaymentMethod = {
  id: number;
  client: number;
  provider: string;
  details: Record<string, unknown> | null;
  is_default: boolean;
  created_at: string;
};

export type PaymentsSummary = {
  total_spent: number;
  recent_transactions: Transaction[];
};

export type ClientProfile = {
  id: number;
  user: number;
  photo: string | null;
  is_active: boolean;
  language: Language;
  created_at: string;
};

export type LatLng = { lat: number; lng: number };

export type AppMode = 'passenger' | 'driver';
