import { createBrowserRouter, RouterProvider, Link, Navigate, Outlet } from 'react-router-dom'
import { Car, MapPinned, ShieldCheck, Wallet, Compass } from 'lucide-react'
// OTP DISABLED for local dev — uncomment to re-enable.
// import Phone from './pages/Auth/Phone'
// import Verify from './pages/Auth/Verify'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import ChauffeurOnboard from './pages/Onboard/Chauffeur'
import DriverMap from './pages/Map/DriverMap'
import AuthMenu from './components/AuthMenu'
import ClientDashboard from './pages/Dashboard/ClientDashboard'
import Account from './pages/Account/Account'
import DriverDashboard from './pages/Driver/DriverDashboard'
import AdminUsers from './pages/Admin/AdminUsers'
import AdminOverview from './pages/Admin/AdminOverview'
import RequireClient from './components/RequireClient'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import RequireChauffeur from './components/RequireChauffeur'
import Button from './components/ui/Button'
import Spinner from './components/ui/Spinner'
import { useAuth } from './context/AuthContext'
import './index.css'

function Layout() {
  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-warm-gradient text-white">
              <Car size={16} />
            </span>
            samaChauffeur
          </Link>
          <AuthMenu />
        </div>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

// Redirects to the signed-in user's own space instead of the marketing landing page.
function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }
  if (user?.role === 'CLIENT') return <Navigate to="/dashboard" replace />
  if (user?.role === 'CHAUFFEUR') return <Navigate to="/driver-map" replace />
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />

  return (
    <div>
      <section className="bg-hero-gradient text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-white/15 text-xs font-semibold tracking-wide uppercase px-3 py-1 mb-4">
              Covoiturage & transport
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">Où que vous alliez, on vous y emmène.</h1>
            <p className="text-white/85 text-lg mb-8 max-w-md">
              Courses privées, trajets partagés et lignes de bus — réservez en quelques secondes et suivez votre chauffeur en direct sur la carte.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth/register">
                <Button size="lg" className="!bg-white !text-brand-700 hover:!bg-brand-50">
                  Réserver une course
                </Button>
              </Link>
              <Link to="/auth/register">
                <Button size="lg" variant="ghost" className="!text-white border border-white/30 hover:!bg-white/10">
                  Devenir chauffeur
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 rounded-3xl bg-white/10 blur-2xl" />
            <div className="relative rounded-2xl bg-white/10 border border-white/20 p-6 backdrop-blur">
              <div className="flex items-center gap-3 mb-4">
                <span className="live-dot" />
                <span className="text-sm text-white/80">3 chauffeurs disponibles autour de vous</span>
              </div>
              <div className="h-56 rounded-xl bg-white/10 grid place-items-center text-white/50 text-sm">Carte en temps réel</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-6">
        {[
          { icon: MapPinned, title: 'Géolocalisation en direct', text: 'Suivez votre chauffeur (ou vos passagers) en temps réel sur la carte.' },
          { icon: ShieldCheck, title: 'Chauffeurs vérifiés', text: 'Chaque chauffeur est validé manuellement avant de prendre la route.' },
          { icon: Wallet, title: 'Paiement flexible', text: 'Espèces, Orange Money, Wave — choisissez ce qui vous arrange.' },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-stone-100 bg-white p-6 shadow-card">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 mb-4">
              <f.icon size={20} />
            </span>
            <h3 className="font-semibold text-stone-900 mb-1.5">{f.title}</h3>
            <p className="text-sm text-stone-500">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

// Branded fallback shown for any URL that doesn't match a real route (typo, stale link,
// removed page) — replaces react-router's default "Unexpected Application Error" screen.
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      // OTP DISABLED for local dev — uncomment to re-enable.
      // { path: 'auth/phone', element: <Phone /> },
      // { path: 'auth/verify', element: <Verify /> },
      { path: 'auth/login', element: <Login /> },
      { path: 'auth/register', element: <Register /> },
      { path: 'onboard', element: <div className="text-center py-20">Onboarding pages coming soon</div> },
      { path: 'onboard/chauffeur', element: <RequireAuth><ChauffeurOnboard /></RequireAuth> },
      { path: 'map', element: <DriverMap /> },
      { path: 'driver-map', element: <RequireChauffeur><DriverDashboard /></RequireChauffeur> },
      { path: 'dashboard', element: <RequireClient><ClientDashboard /></RequireClient> },
      { path: 'admin', element: <RequireAdmin><AdminOverview /></RequireAdmin> },
      { path: 'admin/users', element: <RequireAdmin><AdminUsers /></RequireAdmin> },
      { path: 'account', element: <RequireAuth><Account /></RequireAuth> },
      { path: '*', element: <NotFound /> },
    ],
  },
], ({
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
} as any))

function App() {
  return <RouterProvider router={router} />
}

export default App
