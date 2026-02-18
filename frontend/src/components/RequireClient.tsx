import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/auth/phone" replace />
  if (user.role !== 'CLIENT') return <div>Access denied</div>
  return <>{children}</>
}