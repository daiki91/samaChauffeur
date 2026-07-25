import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'
import { ShieldAlert } from 'lucide-react'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  if (!user) return <Navigate to="/auth/login" replace />
  if (user.role !== 'ADMIN')
    return (
      <div className="min-h-[60vh] grid place-items-center text-center px-6">
        <div>
          <ShieldAlert size={32} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">Cet espace est réservé aux administrateurs.</p>
        </div>
      </div>
    )
  return <>{children}</>
}
