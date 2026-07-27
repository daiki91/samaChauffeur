import React from 'react'

export type TripStatus = 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED'

const statusStyles: Record<string, string> = {
  SCHEDULED: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  REQUESTED: 'bg-accent-300/40 text-accent-700 dark:bg-accent-400/10 dark:text-accent-300',
  ASSIGNED: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  ACCEPTED: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  ARRIVED: 'bg-accent-300/40 text-accent-700 dark:bg-accent-400/10 dark:text-accent-300',
  STARTED: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-300',
  COMPLETED: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-500/10 dark:text-secondary-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  PENDING: 'bg-accent-300/40 text-accent-700 dark:bg-accent-400/10 dark:text-accent-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  OPEN: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
}

const statusLabelsFr: Record<string, string> = {
  SCHEDULED: 'Programmée',
  REQUESTED: 'Recherche...',
  ASSIGNED: 'Chauffeur assigné',
  ACCEPTED: 'Accepté',
  ARRIVED: 'Chauffeur arrivé',
  STARTED: 'En route',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  PENDING: 'En attente',
  FAILED: 'Échouée',
  OPEN: 'Ouvert',
}

export default function Badge({ status, children }: { status?: string; children?: React.ReactNode }) {
  if (children) {
    return <span className="inline-flex items-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium px-2.5 py-1">{children}</span>
  }
  const key = status || ''
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${statusStyles[key] || 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}>
      {statusLabelsFr[key] || key}
    </span>
  )
}
