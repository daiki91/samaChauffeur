import React, { createContext, useContext, useEffect, useState } from 'react'
import { getMe, setAuthToken } from '../lib/api'

type User = {
  id: number
  username: string
  phone: string
  role: string
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

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>{children}</AuthContext.Provider>
  )
}
