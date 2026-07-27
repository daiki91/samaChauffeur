import { Link, Navigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Reveal from '../../components/landing/Reveal'
import HeroHighlights from '../../components/landing/HeroHighlights'
import Features from '../../components/landing/Features'
import AppDownload from '../../components/landing/AppDownload'
import Footer from '../../components/landing/Footer'
import { useAuth } from '../../context/AuthContext'

// Redirects to the signed-in user's own space instead of the marketing landing page.
export default function Home() {
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
      <section className="relative overflow-hidden bg-hero-gradient text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 items-center">
          <Reveal variant="left">
            <span className="inline-block rounded-full bg-white/15 text-xs font-semibold tracking-wide uppercase px-3 py-1 mb-4">
              Covoiturage & transport
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
              Où que vous alliez, on vous y emmène.
            </h1>
            <p className="text-white/85 text-lg mb-8 max-w-md">
              Courses privées, trajets partagés et lignes de bus — réservez en quelques secondes et suivez votre
              chauffeur en direct sur la carte.
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
          </Reveal>

          <Reveal variant="right" delay={120} className="hidden lg:block">
            <HeroHighlights />
          </Reveal>
        </div>

        <div className="relative flex justify-center pb-6 text-white/60 animate-bounce-down">
          <ChevronDown size={22} />
        </div>
      </section>

      <Features />
      <AppDownload />
      <Footer />
    </div>
  )
}
