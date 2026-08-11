import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Car, BarChart3, UserRound } from 'lucide-react'

const TABS = [
  { to: '/driver-map', label: 'Course', icon: Car },
  { to: '/espace-chauffeur', label: 'Gains', icon: BarChart3 },
  { to: '/account', label: 'Compte', icon: UserRound },
]

// Mobile-only tab bar for drivers — the top nav (AuthMenu) hides its "Course"/"Espace
// chauffeur" links below `sm`, which otherwise leaves a driver on a phone with no way to
// move between pages besides the browser back button.
export default function DriverBottomNav() {
  const { user } = useAuth()
  const location = useLocation()

  if (user?.role !== 'CHAUFFEUR') return null

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-100" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch max-w-md mx-auto">
        {TABS.map((tab) => {
          const active = location.pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${active ? 'text-brand-600' : 'text-stone-400'}`}
            >
              <tab.icon size={20} strokeWidth={active ? 2.5 : 2} className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
