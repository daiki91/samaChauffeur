import { useRef, useState } from 'react'
import { Star, Zap, ShieldCheck } from 'lucide-react'
import heroCar from '../../assets/hero-car.png'

/** Hero visual: a photo car tilted in pseudo-3D, surrounded by floating "live stat" chips. */
export default function HeroHighlights() {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -10, y: px * 14 })
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-[22rem] sm:h-[26rem] [perspective:1200px]"
    >
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-72 h-72 rounded-full bg-accent-400/30 blur-3xl animate-pulse-slow" />
      </div>

      <div className="absolute top-6 left-2 sm:left-6 z-20 animate-float-slow" style={{ animationDelay: '1.2s' }}>
        <Chip icon={ShieldCheck} tone="brand" title="100% vérifiés" subtitle="chauffeurs contrôlés" />
      </div>

      <div className="absolute top-6 right-2 sm:right-6 z-20 animate-float-slow">
        <Chip icon={Star} iconFill tone="accent" title="4.9/5" subtitle="+12 000 courses" />
      </div>

      <div className="absolute bottom-10 left-0 sm:left-4 z-20 animate-float">
        <Chip icon={Zap} tone="secondary" title="3 min" subtitle="chauffeur le plus proche" />
      </div>

      <div className="absolute inset-0 grid place-items-center [transform-style:preserve-3d]">
        <div className="animate-float [transform-style:preserve-3d]">
          <div
            className="transition-transform duration-300 ease-out [transform-style:preserve-3d] drop-shadow-[0_25px_25px_rgba(0,0,0,0.35)]"
            style={{ transform: `rotateX(${8 + tilt.x}deg) rotateY(${-18 + tilt.y}deg)` }}
          >
            <img src={heroCar} alt="Voiture samaChauffeur" className="w-72 sm:w-80 h-auto select-none" draggable={false} />
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 bottom-8 -translate-x-1/2 w-52 h-7 rounded-full bg-black/30 blur-xl animate-shadow-pulse" />
    </div>
  )
}

const toneClasses = {
  accent: 'bg-accent-400/20 text-accent-600',
  secondary: 'bg-secondary-500/15 text-secondary-600',
  brand: 'bg-brand-500/15 text-brand-600',
}

function Chip({
  icon: Icon,
  iconFill,
  tone,
  title,
  subtitle,
}: {
  icon: typeof Star
  iconFill?: boolean
  tone: keyof typeof toneClasses
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/95 shadow-floating px-3.5 py-2.5 text-stone-800">
      <span className={`grid place-items-center w-8 h-8 rounded-xl ${toneClasses[tone]}`}>
        <Icon size={16} fill={iconFill ? 'currentColor' : 'none'} />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[11px] text-stone-500">{subtitle}</p>
      </div>
    </div>
  )
}
