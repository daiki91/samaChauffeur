import { Bell, MapPinned, Wallet } from 'lucide-react'
import Reveal from '../ui/Reveal'
import appleStoreLogo from '../../assets/apple-store.png'
import googlePlayLogo from '../../assets/google-play.jpg'

export default function AppDownload() {
  return (
    <section className="relative overflow-hidden bg-stone-900 py-20 sm:py-28">
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-secondary-500/20 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal variant="left">
          <span className="inline-block rounded-full bg-white/10 text-accent-300 text-xs font-semibold tracking-wide uppercase px-3 py-1 mb-4">
            L'app mobile
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
            samaChauffeur dans votre poche, partout où vous allez
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-md">
            Réservez une course en deux tapotements, suivez votre chauffeur en direct et payez sans sortir de
            l'application — l'app mobile arrive bientôt sur App Store et Google Play.
          </p>

          {/* Not live yet — shown as inert badges rather than links that go nowhere. */}
          <div className="flex flex-wrap gap-4 mb-10">
            <span className="flex items-center gap-3 rounded-2xl bg-white/90 px-5 py-3 text-stone-900 cursor-not-allowed opacity-80">
              <img src={appleStoreLogo} alt="" className="w-7 h-7 shrink-0 object-contain" />
              <span className="text-left leading-tight">
                <span className="block text-[10px] uppercase tracking-wide text-stone-500">Bientôt sur</span>
                <span className="block text-base font-bold -mt-0.5">App Store</span>
              </span>
            </span>
            <span className="flex items-center gap-3 rounded-2xl bg-white/90 px-5 py-3 text-stone-900 cursor-not-allowed opacity-80">
              <img src={googlePlayLogo} alt="" className="w-7 h-7 shrink-0 object-contain rounded-sm" />
              <span className="text-left leading-tight">
                <span className="block text-[10px] uppercase tracking-wide text-stone-500">Bientôt sur</span>
                <span className="block text-base font-bold -mt-0.5">Google Play</span>
              </span>
            </span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/60">
            <span className="flex items-center gap-2">
              <Bell size={16} className="text-accent-300" /> Notifications en temps réel
            </span>
            <span className="flex items-center gap-2">
              <MapPinned size={16} className="text-accent-300" /> Suivi GPS live
            </span>
            <span className="flex items-center gap-2">
              <Wallet size={16} className="text-accent-300" /> Paiement mobile
            </span>
          </div>
        </Reveal>

        <Reveal variant="zoom" className="flex justify-center">
          <PhoneMockup />
        </Reveal>
      </div>
    </section>
  )
}

function PhoneMockup() {
  return (
    <div className="relative animate-float-slow [perspective:1200px]">
      <div
        className="relative w-56 sm:w-64 h-[26rem] sm:h-[30rem] rounded-[2.5rem] bg-stone-950 border-[6px] border-stone-800 shadow-floating overflow-hidden"
        style={{ transform: 'rotateY(-12deg) rotateX(4deg)' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-stone-950 rounded-b-2xl z-10" />
        <div className="h-full w-full bg-warm-gradient animate-gradient-pan p-5 flex flex-col">
          <div className="flex items-center justify-between text-white/90 text-xs mt-2 mb-6">
            <span className="font-semibold">samaChauffeur</span>
            <span className="live-dot" />
          </div>
          <div className="rounded-2xl bg-white/15 backdrop-blur p-4 mb-4">
            <p className="text-white text-xs mb-2">Chauffeur en route</p>
            <div className="h-24 rounded-xl bg-white/15" />
          </div>
          <div className="rounded-2xl bg-white/95 p-4 mt-auto">
            <p className="text-stone-500 text-[10px] uppercase tracking-wide mb-1">Arrivée estimée</p>
            <p className="text-stone-900 font-bold text-lg">4 minutes</p>
          </div>
        </div>
      </div>
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand-500/20 blur-3xl" />
    </div>
  )
}
