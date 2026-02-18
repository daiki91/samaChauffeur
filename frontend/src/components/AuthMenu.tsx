import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthMenu() {
  const { user, loading, logout } = useAuth()

  if (loading) return <div className="text-sm text-gray-700">Loading...</div>

  if (!user) {
    return (
      <>
        <Link to="/auth/login" className="mr-4 text-sm text-gray-700">Se connecter</Link>
        <Link to="/auth/register" className="mr-4 text-sm text-gray-700">Créer un compte</Link>
      </>
    )
  }

  return (
    <>
      <span className="mr-4 text-sm text-gray-700">{user.username} ({user.role})</span>
      {user.role === 'CHAUFFEUR' ? (
        <Link to="/map" className="mr-4 text-sm text-gray-700">Carte</Link>
      ) : (
        <Link to="/onboard/chauffeur" className="mr-4 text-sm text-gray-700">Devenir chauffeur</Link>
      )}
      <button className="text-sm text-red-600" onClick={logout}>Déconnexion</button>
    </>
  )
}
