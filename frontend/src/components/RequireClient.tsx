import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'
import { ShieldAlert } from 'lucide-react'

export default function RequireClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== 'CLIENT')
    return (
      <div className="min-h-[60vh] grid place-items-center text-center px-6">
        <div>
          <ShieldAlert size={32} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">Cet espace est réservé aux passagers.</p>
        </div>
      </div>
    )
  return <>{children}</>
}
