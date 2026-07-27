import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getMe, setAuthToken } from '../lib/api'
import { connectPresenceSocket } from '../lib/socket'

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const presenceSocketRef = useRef<Socket | null>(null)

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
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const socket = await connectPresenceSocket()
      if (!socket || !active) return
      presenceSocketRef.current = socket
    })()
    return () => {
      active = false
      presenceSocketRef.current?.disconnect()
      presenceSocketRef.current = null
    }
  }, [user])

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setAuthToken(null)
    presenceSocketRef.current?.disconnect()
    presenceSocketRef.current = null
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>{children}</AuthContext.Provider>
  )
}
