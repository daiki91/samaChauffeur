import { createBrowserRouter, RouterProvider, Link, Outlet } from 'react-router-dom'
import { Car, Compass } from 'lucide-react'
// OTP DISABLED for local dev — uncomment to re-enable.
// import Phone from'./pages/Auth/Phone'
// import Verify from'./pages/Auth/Verify'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import ChauffeurOnboard from './pages/Onboard/Chauffeur'
import DriverMap from './pages/Map/DriverMap'
import AuthMenu from './components/AuthMenu'
import ClientDashboard from './pages/Dashboard/ClientDashboard'
import Rewards from './pages/Rewards/Rewards'
import Account from './pages/Account/Account'
import DriverDashboard from './pages/Driver/DriverDashboard'
import DriverStats from './pages/Driver/DriverStats'
import AdminOverview from './pages/Admin/AdminOverview'
import AdminUsers from './pages/Admin/AdminUsers'
import AdminMap from './pages/Admin/AdminMap'
import Home from './pages/Home/Home'
import SharedTrip from './pages/Share/SharedTrip'
import RequireClient from './components/RequireClient'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import RequireChauffeur from './components/RequireChauffeur'
import Button from './components/ui/Button'
import './index.css'

function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 transition-colors">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-warm-gradient text-white">
              <Car size={16} />
            </span>
            samaChauffeur
          </Link>
          <div className="flex items-center gap-1.5">
            <AuthMenu />
          </div>
        </div>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

// Branded fallback shown for any URL that doesn't match a real route (typo, stale link,
// removed page) — replaces react-router's default"Unexpected Application Error"screen.
function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center px-6">
      <div>
        <span className="grid place-items-center w-16 h-16 rounded-2xl bg-brand-50 text-brand-500 mx-auto mb-4">
          <Compass size={28} />
        </span>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Page introuvable</h1>
        <p className="text-stone-500 mb-6 max-w-sm">Cette page n'existe pas ou a été déplacée.</p>
        <Link to="/">
          <Button size="lg">Retour à l'accueil</Button>
        </Link>
      </div>
    </div>
  )
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      errorElement: <NotFound />,
      children: [
        { index: true, element: <Home /> },
        // OTP DISABLED for local dev — uncomment to re-enable.
        // { path:'auth/phone', element: <Phone /> },
        // { path:'auth/verify', element: <Verify /> },
        { path: 'auth/login', element: <Login /> },
        { path: 'auth/register', element: <Register /> },
        { path: 'onboard', element: <div className="text-center py-20">Onboarding pages coming soon</div> },
        {
          path: 'onboard/chauffeur',
          element: (
            <RequireAuth>
              <ChauffeurOnboard />
            </RequireAuth>
          ),
        },
        { path: 'map', element: <DriverMap /> },
        { path: 'share/trip/:token', element: <SharedTrip /> },
        {
          path: 'driver-map',
          element: (
            <RequireChauffeur>
              <DriverDashboard />
            </RequireChauffeur>
          ),
        },
        {
          path: 'espace-chauffeur',
          element: (
            <RequireChauffeur>
              <DriverStats />
            </RequireChauffeur>
          ),
        },
        {
          path: 'dashboard',
          element: (
            <RequireClient>
              <ClientDashboard />
            </RequireClient>
          ),
        },
        {
          path: 'rewards',
          element: (
            <RequireClient>
              <Rewards />
            </RequireClient>
          ),
        },
        {
          path: 'admin',
          element: (
            <RequireAdmin>
              <AdminOverview />
            </RequireAdmin>
          ),
        },
        {
          path: 'admin/users',
          element: (
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
          ),
        },
        {
          path: 'admin/map',
          element: (
            <RequireAdmin>
              <AdminMap />
            </RequireAdmin>
          ),
        },
        {
          path: 'account',
          element: (
            <RequireAuth>
              <Account />
            </RequireAuth>
          ),
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  } as any,
)

function App() {
  return <RouterProvider router={router} />
}

export default App
