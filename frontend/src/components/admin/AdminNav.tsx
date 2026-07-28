import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, MapPinned } from 'lucide-react'

const links = [
  { to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Comptes connectés', icon: Users, end: true },
  { to: '/admin/map', label: 'Carte', icon: MapPinned, end: true },
]

/** Shared tab nav across the admin pages (overview / online accounts / live map). */
export default function AdminNav() {
  return (
    <div className="flex items-center gap-1 mb-5 border-b border-stone-100 overflow-x-auto">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              isActive ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}
