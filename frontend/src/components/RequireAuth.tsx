import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'

/** Any authenticated account (role doesn't matter) — e.g. account settings, chauffeur application. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}
