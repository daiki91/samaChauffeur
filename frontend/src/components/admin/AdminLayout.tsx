import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Car,
  Truck,
  Route as RouteIcon,
  Wallet,
  Activity,
  MapPinned,
  Menu,
  X,
  ShieldAlert,
  MapPin,
  Check,
} from 'lucide-react'
import { AdminSosProvider, useAdminSos } from '../../context/AdminSosContext'
import { useToasts } from '../Toasts'
import Button from '../ui/Button'
import { getAdminPayouts } from '../../lib/api'
import { formatDateTime } from '../../lib/adminFormat'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: number }

function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`
          }
        >
          <Icon size={16} className="shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {!!badge && (
            <span className="grid place-items-center min-w-[1.25rem] h-5 px-1 rounded-full bg-accent-500 text-white text-[10px] font-bold">
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SosPanel() {
  const { unresolved, resolving, resolve } = useAdminSos()
  const { addToast } = useToasts()

  const handleResolve = async (id: number) => {
    try {
      await resolve(id)
      addToast({ message: 'Alerte marquée comme résolue.', tone: 'success' })
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || "Erreur lors de la résolution de l'alerte", tone: 'error' })
    }
  }

  if (unresolved.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-6">Aucune alerte SOS en cours.</p>
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto divide-y divide-stone-100">
      {unresolved.map((a) => (
        <div key={a.id} className="px-4 py-3">
          <div className="font-medium text-stone-800 text-sm truncate">
            {a.passenger_username} · {a.passenger_phone}
          </div>
          <div className="text-xs text-stone-500 truncate mt-0.5">
            Course #{a.trip_id} — {a.trip_origin} → {a.trip_destination}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">{formatDateTime(a.created_at)}</div>
          <div className="flex items-center gap-2 mt-2">
            {a.latitude != null && a.longitude != null && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=16/${a.latitude}/${a.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <MapPin size={12} /> Position
              </a>
            )}
            <Button size="sm" variant="danger" loading={resolving === a.id} onClick={() => handleResolve(a.id)} icon={<Check size={13} />}>
              Marquer résolu
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SosBell() {
  const { unresolved } = useAdminSos()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative grid place-items-center w-9 h-9 rounded-full transition-colors ${
          unresolved.length > 0 ? 'text-red-600 hover:bg-red-50' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
        }`}
        title="Alertes SOS"
      >
        <ShieldAlert size={18} />
        {unresolved.length > 0 && (
          <span className="absolute top-1 right-1 grid place-items-center min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold">
            {unresolved.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-white rounded-2xl shadow-floating border border-stone-100 z-50 animate-fade-in-up">
            <div className="px-4 py-3 border-b border-stone-100 font-semibold text-stone-800 text-sm flex items-center gap-2">
              <ShieldAlert size={15} className="text-red-600" />
              Alertes SOS
            </div>
            <SosPanel />
          </div>
        </>
      )}
    </div>
  )
}

function SosBanner() {
  const { unresolved } = useAdminSos()
  const [open, setOpen] = useState(false)
  if (unresolved.length === 0) return null
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2 hover:bg-red-700 transition-colors"
      >
        <ShieldAlert size={15} />
        {unresolved.length} alerte{unresolved.length > 1 ? 's' : ''} SOS en cours — cliquez pour gérer
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-96 max-w-[92vw] bg-white rounded-2xl shadow-floating border border-stone-100 z-50 animate-fade-in-up">
            <div className="px-4 py-3 border-b border-stone-100 font-semibold text-stone-800 text-sm">Alertes SOS en cours</div>
            <SosPanel />
          </div>
        </>
      )}
    </div>
  )
}

function AdminLayoutInner() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingPayouts, setPendingPayouts] = useState(0)

  useEffect(() => {
    getAdminPayouts()
      .then((r) => setPendingPayouts(r.data.filter((p: any) => p.status === 'SCHEDULED').length))
      .catch(() => {})
  }, [])

  const items: NavItem[] = [
    { to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard },
    { to: '/admin/clients', label: 'Clients', icon: Users },
    { to: '/admin/chauffeurs', label: 'Chauffeurs', icon: Car },
    { to: '/admin/vehicules', label: 'Véhicules', icon: Truck },
    { to: '/admin/courses', label: 'Courses', icon: RouteIcon },
    { to: '/admin/retraits', label: 'Retraits', icon: Wallet, badge: pendingPayouts },
    { to: '/admin/users', label: 'Comptes en ligne', icon: Activity },
    { to: '/admin/map', label: 'Carte', icon: MapPinned },
  ]

  return (
    <div className="min-h-[calc(100vh-57px)] bg-stone-50">
      <div className="sticky top-[57px] z-30 bg-white border-b border-stone-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawerOpen(true)} className="lg:hidden grid place-items-center w-9 h-9 rounded-full text-stone-500 hover:bg-stone-100">
              <Menu size={18} />
            </button>
            <span className="font-semibold text-stone-800 hidden sm:inline">Administration</span>
          </div>
          <SosBell />
        </div>
        <SosBanner />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex items-start gap-6">
        <aside className="hidden lg:block w-56 shrink-0 sticky top-[8.5rem]">
          <SidebarNav items={items} />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-stone-900/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-floating p-4 animate-fade-in-up overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-stone-800">Administration</span>
                <button onClick={() => setDrawerOpen(false)} className="grid place-items-center w-8 h-8 rounded-full text-stone-400 hover:bg-stone-100">
                  <X size={16} />
                </button>
              </div>
              <SidebarNav items={items} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminSosProvider>
      <AdminLayoutInner />
    </AdminSosProvider>
  )
}
