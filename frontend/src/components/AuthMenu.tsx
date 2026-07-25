import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Car, MapPin, LogOut, Users } from 'lucide-react'
import Button from './ui/Button'

export default function AuthMenu() {
  const { user, loading, logout } = useAuth()

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
      {user.role === 'CHAUFFEUR' ? (
        <Link to="/driver-map" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
          <Car size={15} />
          Espace chauffeur
        </Link>
      ) : user.role === 'CLIENT' ? null : (
        <Link to="/onboard/chauffeur" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
          <MapPin size={15} />
          Devenir chauffeur
        </Link>
      )}

      {user.role === 'ADMIN' && (
        <Link to="/admin/users" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-600">
          <Users size={15} />
          Comptes connectés
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
