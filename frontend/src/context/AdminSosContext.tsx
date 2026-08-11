import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getAdminSosAlerts, resolveSosAlert } from '../lib/api'

export type SosAlert = {
  id: number
  trip_id: number
  trip_origin: string
  trip_destination: string
  passenger_username: string
  passenger_phone: string
  latitude: number | null
  longitude: number | null
  resolved: boolean
  created_at: string
}

type Ctx = {
  alerts: SosAlert[]
  unresolved: SosAlert[]
  resolving: number | null
  resolve: (id: number) => Promise<void>
}

const AdminSosContext = createContext<Ctx | undefined>(undefined)

export function useAdminSos() {
  const ctx = useContext(AdminSosContext)
  if (!ctx) throw new Error('useAdminSos must be used within AdminSosProvider')
  return ctx
}

/**
 * Shared, sitewide SOS alert state for the admin area — polled once here instead of per-page,
 * so the alert bell/banner in AdminLayout stays in sync no matter which admin page is open.
 */
export function AdminSosProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<SosAlert[]>([])
  const [resolving, setResolving] = useState<number | null>(null)

  const load = useCallback(() => {
    getAdminSosAlerts()
      .then((r) => setAlerts(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [load])

  const resolve = useCallback(async (id: number) => {
    setResolving(id)
    try {
      await resolveSosAlert(id)
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)))
    } finally {
      setResolving(null)
    }
  }, [])

  const unresolved = useMemo(() => alerts.filter((a) => !a.resolved), [alerts])

  return <AdminSosContext.Provider value={{ alerts, unresolved, resolving, resolve }}>{children}</AdminSosContext.Provider>
}
