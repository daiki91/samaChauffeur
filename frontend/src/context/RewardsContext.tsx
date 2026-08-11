import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getRewardsStatus } from '../lib/api'
import { useAuth } from './AuthContext'

type RewardsStatus = {
  total_distance_km: number
  last_checkpoint_km: number
  next_checkpoint_km: number
  pending_discount: { pct: number; label: string } | null
  history: { km: number; discount_pct: number | null; created_at: string }[]
}

type RewardsContextValue = {
  status: RewardsStatus | null
  loading: boolean
  error: boolean
  refresh: () => void
}

const RewardsContext = createContext<RewardsContextValue | undefined>(undefined)

export function useRewards() {
  const ctx = useContext(RewardsContext)
  if (!ctx) throw new Error('useRewards must be used within RewardsProvider')
  return ctx
}

// Single source of truth for the km-progression rewards status — the navbar gift badge
// (AuthMenu), the /rewards page, and the dashboard's discount banner (ClientDashboard) all
// read from here instead of each independently polling GET /trips/rewards/.
export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<RewardsStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const refresh = useCallback(() => {
    if (user?.role !== 'CLIENT') return
    setLoading(true)
    setError(false)
    getRewardsStatus()
      .then((r) => setStatus(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      setStatus(null)
      return
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  return <RewardsContext.Provider value={{ status, loading, error, refresh }}>{children}</RewardsContext.Provider>
}
