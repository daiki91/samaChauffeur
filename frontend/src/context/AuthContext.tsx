import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getMe, setAuthToken, setChauffeurAvailability } from '../lib/api'
import { connectPresenceSocket, connectDriverSocket } from '../lib/socket'

type User = {
  id: number
  username: string
  phone: string
  role: string
  language?: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
  logout: () => void
  /** Chauffeur-only "online/available" flag — defaults to true (offline is the exception,
   *  an explicit action), shared between AuthContext (which owns the live position feed) and
   *  the driver dashboard's own "En ligne/Hors ligne" toggle so the two never drift apart. */
  driverOnline: boolean
  /** Toggles it: persists to the server (POST /chauffeurs/availability/) and localStorage. */
  setDriverOnline: (next: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Absent from localStorage (first login, new chauffeur) => online by default. Only an explicit
// 'false' (the driver toggled off, or a rejected socket forced it off) counts as offline.
const DRIVER_ONLINE_KEY = 'driver_online'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [driverOnline, setDriverOnlineState] = useState(() => localStorage.getItem(DRIVER_ONLINE_KEY) !== 'false')
  const presenceSocketRef = useRef<Socket | null>(null)
  const driverSocketRef = useRef<Socket | null>(null)

  const refreshUser = async () => {
    try {
      const resp = await getMe()
      setUser(resp.data)
    } catch (e) {
      setUser(null)
    }
  }

  useEffect(() => {
    // init auth from localStorage
    const access = localStorage.getItem('access')
    if (access) setAuthToken(access)
    refreshUser().finally(() => setLoading(false))

    // expose a global refresh helper for pages to call after login
    ;(window as any).authRefresh = refreshUser

    return () => {
      ;(window as any).authRefresh = undefined
    }
  }, [])

  // Fire-and-forget presence heartbeat — no UI here, it just makes this user show up as
  // "online" to admins. Connects once refreshUser() has resolved a logged-in user.
  //
  // Also streams this device's GPS position (throttled) over the same socket via
  // 'location.update' — for ANY logged-in role, not just chauffeurs mid-trip. That's what
  // lets the admin "map" page (see pages/Admin/AdminMap.tsx) show clients too, and it's what
  // fills in User.lastLatitude/lastLongitude so a now-offline user still shows their last
  // known spot. Silently does nothing if the browser denies/lacks geolocation.
  useEffect(() => {
    if (!user) return
    let active = true
    let watchId: number | null = null
    const LOCATION_EMIT_THROTTLE_MS = 20_000
    let lastSentAt = 0
    ;(async () => {
      const socket = await connectPresenceSocket()
      if (!socket || !active) return
      presenceSocketRef.current = socket

      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now()
            if (now - lastSentAt < LOCATION_EMIT_THROTTLE_MS) return
            lastSentAt = now
            socket.emit('location.update', { lat: pos.coords.latitude, lng: pos.coords.longitude })
          },
          () => {
            // permission denied or unavailable — presence heartbeat still works without it
          },
          { enableHighAccuracy: false, maximumAge: 15000, timeout: 15000 },
        )
      }
    })()
    return () => {
      active = false
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      presenceSocketRef.current?.disconnect()
      presenceSocketRef.current = null
    }
  }, [user])

  // Chauffeur live-position feed — connects as soon as the user is a (verified) chauffeur and
  // `driverOnline` is true, independent of which page is open. Before this, a chauffeur only
  // showed up with a live position/on the admin map while the driver dashboard page happened to
  // be mounted; now it's tied to being logged in + online, matching "online by default, offline
  // is the explicit exception". The driver dashboard's own socket(s) — trip notifications, the
  // embedded live map — are unaffected and keep working exactly as before on top of this.
  useEffect(() => {
    if (!user || user.role !== 'CHAUFFEUR' || !driverOnline) return
    let active = true
    let watchId: number | null = null
    const socket = connectDriverSocket()
    if (!socket) return
    driverSocketRef.current = socket

    socket.on('connect_error', () => {
      // Not verified yet (or auth issue) — nothing to do, the driver just won't broadcast
      // a live position until an admin verifies them. No user-facing error here: this runs
      // in the background on every page, not just the driver dashboard.
    })

    if ('geolocation' in navigator) {
      const EMIT_THROTTLE_MS = 5_000
      let lastSentAt = 0
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!active) return
          const now = Date.now()
          if (now - lastSentAt < EMIT_THROTTLE_MS) return
          lastSentAt = now
          socket.emit('location.update', { lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {
          // permission denied/unavailable — presence status still shows the chauffeur online,
          // just without a live pin until they grant location access.
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      )
    }

    return () => {
      active = false
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      socket.disconnect()
      driverSocketRef.current = null
    }
  }, [user, driverOnline])

  const setDriverOnline = async (next: boolean) => {
    await setChauffeurAvailability(next)
    localStorage.setItem(DRIVER_ONLINE_KEY, String(next))
    setDriverOnlineState(next)
  }

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setAuthToken(null)
    presenceSocketRef.current?.disconnect()
    presenceSocketRef.current = null
    driverSocketRef.current?.disconnect()
    driverSocketRef.current = null
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, driverOnline, setDriverOnline }}>
      {children}
    </AuthContext.Provider>
  )
}
