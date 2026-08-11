/** Two-letter uppercase initials shown in avatar badges across the app. */
export function getInitials(name?: string | null): string {
  return (name || '?').slice(0, 2).toUpperCase()
}

/** Single source of truth for vehicle type labels — used to be redeclared (and drift, e.g.
 *  "Bus" vs "Bus rapide") independently in Account.tsx, TripDetailModal.tsx and SharedTrip.tsx. */
export const VEHICLE_LABELS: Record<string, string> = {
  CAR: 'Voiture',
  SEDAN: 'Berline',
  SUV: '4x4',
  MINIBUS: 'Minibus',
  BUS: 'Bus rapide',
}
