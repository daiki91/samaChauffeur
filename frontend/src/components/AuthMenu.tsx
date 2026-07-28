import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Car, LogOut, LayoutDashboard, BarChart3, Gift } from 'lucide-react'
import Button from './ui/Button'
import { getRewardsStatus } from '../lib/api'

export default function AuthMenu() {
  const { user, loading, logout } = useAuth()
  const [hasPendingReward, setHasPendingReward] = useState(false)

  useEffect(() => {
    if (user?.role !== 'CLIENT') return
    getRewardsStatus()
      .then((r) => setHasPendingReward(!!r.data?.pending_discount))
      .catch(() => {})
  }, [user?.role])

  if (loading) return <div className="text-sm text-stone-400">...</div>

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link to="/auth/login" className="text-sm font-medium text-stone-600 hover:text-stone-900">
          Se connecter
        </Link>
        <Link to="/auth/register">
          <Button size="sm">Créer un compte</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {user.role === 'CHAUFFEUR' && (
        <>
          <Link to="/driver-map" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
            <Car size={15} />
            Course
          </Link>
          <Link to="/espace-chauffeur" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
            <BarChart3 size={15} />
            Espace chauffeur
          </Link>
        </>
      )}

      {user.role === 'ADMIN' && (
        <Link to="/admin" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
          <LayoutDashboard size={15} />
          Vue d'ensemble
        </Link>
      )}

      {user.role === 'CLIENT' && (
        <Link to="/rewards" title="Cadeaux de route" className="relative grid place-items-center w-9 h-9 rounded-full text-stone-500 hover:text-brand-600 hover:bg-brand-50 transition-colors">
          <Gift size={18} />
          {hasPendingReward && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary-500" />
            </span>
          )}
        </Link>
      )}

      <div className="flex items-center gap-2 pl-3 border-l border-stone-200">
        <Link to="/account" className="flex items-center gap-2 rounded-lg hover:bg-stone-50 transition-colors -m-1 p-1">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-semibold text-xs uppercase">
            {user.username?.slice(0, 2)}
          </span>
          <div className="hidden sm:block text-sm leading-tight">
            <div className="font-medium text-stone-800">{user.username}</div>
            <div className="text-xs text-stone-400">{user.role === 'CHAUFFEUR' ? 'Chauffeur' : user.role === 'ADMIN' ? 'Admin' : 'Passager'}</div>
          </div>
        </Link>
        <button
          onClick={logout}
          title="Déconnexion"
          className="ml-1 grid place-items-center w-8 h-8 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}
