/** Shared labels/formatters used across the admin pages. */

export const VEHICLE_LABELS: Record<string, string> = { CAR: 'Voiture', SEDAN: 'Berline', SUV: '4x4', MINIBUS: 'Minibus', BUS: 'Bus' }

export const PAYMENT_LABELS: Record<string, string> = { CASH: 'Espèces', ORANGE: 'Orange Money', WAVE: 'Wave', FREE: 'Free Money', CARD: 'Carte' }

export type PayoutStatus = 'SCHEDULED' | 'PROCESSED' | 'FAILED'

export const PAYOUT_STATUS_STYLE: Record<PayoutStatus, { label: string; className: string }> = {
  SCHEDULED: { label: 'En attente', className: 'bg-accent-300/40 text-accent-700' },
  PROCESSED: { label: 'Versé', className: 'bg-secondary-100 text-secondary-800' },
  FAILED: { label: 'Échoué', className: 'bg-red-100 text-red-700' },
}

export const STATUS_ORDER = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED']

export const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-accent-400',
  ASSIGNED: 'bg-brand-400',
  ACCEPTED: 'bg-brand-500',
  STARTED: 'bg-secondary-400',
  COMPLETED: 'bg-secondary-600',
  CANCELLED: 'bg-red-400',
}

export const roleLabelsFr: Record<string, string> = {
  CLIENT: 'Passager',
  CHAUFFEUR: 'Chauffeur',
  ADMIN: 'Admin',
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'jamais connecté'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}
