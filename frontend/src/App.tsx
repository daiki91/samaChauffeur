import { createBrowserRouter, RouterProvider, Link, Outlet } from 'react-router-dom'
import Phone from './pages/Auth/Phone'
import Verify from './pages/Auth/Verify'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import ChauffeurOnboard from './pages/Onboard/Chauffeur'
import DriverMap from './pages/Map/DriverMap'
import AuthMenu from './components/AuthMenu'
import ClientDashboard from './pages/Dashboard/ClientDashboard'
import DriverDashboard from './pages/Driver/DriverDashboard'
import RequireClient from './components/RequireClient'
import './index.css'

function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="p-4 bg-white shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-brand-blue-500">SamaChauffeur</Link>
          <div>
            <AuthMenu />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <div className="text-center py-20">Welcome to SamaChauffeur</div> },
      { path: 'auth/phone', element: <Phone /> },
      { path: 'auth/verify', element: <Verify /> },
      { path: 'auth/login', element: <Login /> },
      { path: 'auth/register', element: <Register /> },
      { path: 'onboard', element: <div className="text-center py-20">Onboarding pages coming soon</div> },
      { path: 'onboard/chauffeur', element: <ChauffeurOnboard /> },
      { path: 'map', element: <DriverMap /> },
      { path: 'driver-map', element: <DriverDashboard /> },
      { path: 'dashboard', element: <RequireClient><ClientDashboard /></RequireClient> },
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
