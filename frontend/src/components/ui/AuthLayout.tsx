import React from 'react'
import { Link } from 'react-router-dom'
import { Car } from 'lucide-react'

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left — brand / hero panel (hidden on small screens) */}
      <div className="hidden lg:flex flex-col justify-between bg-hero-gradient text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -left-16 bottom-10 w-64 h-64 rounded-full bg-white/10" />
        <Link to="/" className="flex items-center gap-2 text-xl font-bold relative z-10">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/20">
            <Car size={20} />
          </span>
          samaChauffeur
        </Link>
        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold leading-tight mb-3">Où que vous alliez, on vous y emmène.</h2>
          <p className="text-white/85">Covoiturage, courses privées et transport en bus — réservez en quelques secondes, suivez votre chauffeur en direct.</p>
        </div>
        <p className="relative z-10 text-sm text-white/60">&copy; {new Date().getFullYear()} samaChauffeur</p>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2 text-lg font-bold text-brand-600 mb-8">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500 text-white">
              <Car size={16} />
            </span>
            samaChauffeur
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mb-1.5">{title}</h1>
          {subtitle && <p className="text-sm text-stone-500 mb-6">{subtitle}</p>}
          {children}
          {footer && <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
