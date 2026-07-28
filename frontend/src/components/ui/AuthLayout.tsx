import React from 'react'
import { Link } from 'react-router-dom'
import { Car, Star, ShieldCheck } from 'lucide-react'
import Reveal from './Reveal'

export default function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left — brand / hero panel (hidden on small screens) */}
      <div className="hidden lg:flex flex-col justify-between bg-hero-gradient text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/10 animate-float-slow" />
        <div className="absolute -left-16 bottom-10 w-64 h-64 rounded-full bg-white/10 animate-float" />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:22px_22px] opacity-40" />

        <Link to="/" className="flex items-center gap-2 text-xl font-bold relative z-10">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/20">
            <Car size={20} />
          </span>
          samaChauffeur
        </Link>

        <Reveal variant="left" className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold leading-tight mb-3">Où que vous alliez, on vous y emmène.</h2>
          <p className="text-white/85 mb-6">Covoiturage, courses privées et transport en bus — réservez en quelques secondes, suivez votre chauffeur en direct.</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur px-3.5 py-2.5">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/15 text-accent-300">
                <Star size={14} fill="currentColor" />
              </span>
              <span className="text-sm font-medium">4.9/5 · +12 000 courses</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur px-3.5 py-2.5">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/15 text-secondary-300">
                <ShieldCheck size={14} />
              </span>
              <span className="text-sm font-medium">Chauffeurs vérifiés</span>
            </div>
          </div>
        </Reveal>

        <p className="relative z-10 text-sm text-white/60">&copy; {new Date().getFullYear()} samaChauffeur</p>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        <div className="lg:hidden absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-300/20 blur-3xl" />
        <Reveal variant="up" className="w-full max-w-sm relative">
          <Link to="/" className="lg:hidden flex items-center gap-2 text-lg font-bold text-brand-600 mb-8">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-warm-gradient text-white">
              <Car size={16} />
            </span>
            samaChauffeur
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mb-1.5">{title}</h1>
          {subtitle && <p className="text-sm text-stone-500 mb-6">{subtitle}</p>}
          {children}
          {footer && <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>}
        </Reveal>
      </div>
    </div>
  )
}
