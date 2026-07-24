import React from 'react'

export type TripStatus = 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'STARTED' | 'COMPLETED' | 'CANCELLED'

const statusStyles: Record<string, string> = {
  REQUESTED: 'bg-accent-300/40 text-accent-700',
  ASSIGNED: 'bg-brand-100 text-brand-700',
  ACCEPTED: 'bg-brand-100 text-brand-700',
  STARTED: 'bg-secondary-100 text-secondary-700',
  COMPLETED: 'bg-secondary-100 text-secondary-800',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-accent-300/40 text-accent-700',
  FAILED: 'bg-red-100 text-red-700',
  OPEN: 'bg-brand-100 text-brand-700',
}

const statusLabelsFr: Record<string, string> = {
  REQUESTED: 'Recherche...',
  ASSIGNED: 'Chauffeur assigné',
  ACCEPTED: 'Accepté',
  STARTED: 'En route',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  PENDING: 'En attente',
  FAILED: 'Échouée',
  OPEN: 'Ouvert',
}

export default function Badge({ status, children }: { status?: string; children?: React.ReactNode }) {
  if (children) {
    return <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-600 text-xs font-medium px-2.5 py-1">{children}</span>
  }
  const key = status || ''
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${statusStyles[key] || 'bg-stone-100 text-stone-600'}`}>
      {statusLabelsFr[key] || key}
    </span>
  )
}
