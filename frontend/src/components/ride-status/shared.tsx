import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { getAvailableChauffeurs } from '../../lib/api'
import type { Point } from './types'

type Option = { value: string; label: string }

export function OptionPicker({ options, value, onChange, disabled }: { options: Option[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${value === opt.value ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-card' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:scale-105'} disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function useElapsedSeconds(since?: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!since) return
    const start = new Date(since).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [since])
  return elapsed
}

export function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Re-triggers a short "pop" animation whenever the watched value changes. */
export function usePopOnChange<T>(value: T) {
  const [bump, setBump] = useState(0)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setBump((n) => n + 1)
    }
  }, [value])
  return bump
}

/** Polls nearby available chauffeurs and counts only those matching the given vehicle type. */
export function useNearbyVehicleCount(point: Point | null, vehicleType: string | null, radiusKm = 5) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!point || !vehicleType) {
      setCount(null)
      return
    }
    let cancelled = false
    async function poll() {
      try {
        const r = await getAvailableChauffeurs({ lat: point!.lat, lng: point!.lng, radius: radiusKm })
        if (cancelled) return
        setCount(r.data.filter((d: any) => d.vehicle?.type === vehicleType).length)
      } catch {
        if (!cancelled) setCount(null)
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lng, vehicleType, radiusKm])

  return count
}

const PROGRESS_STEPS = ['Recherche', 'Chauffeur trouvé', 'Arrivée', 'En route'] as const

export function TripProgress({ status }: { status: string }) {
  const stepIndex = status === 'STARTED' ? 3 : status === 'ARRIVED' ? 2 : status === 'ASSIGNED' || status === 'ACCEPTED' ? 1 : 0

  return (
    <div className="flex items-center mb-5">
      {PROGRESS_STEPS.map((label, i) => {
        const done = i < stepIndex
        const current = i === stepIndex
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
                {current && <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-40 animate-ping" />}
                <span className={`relative inline-flex items-center justify-center rounded-full h-7 w-7 text-[11px] font-bold transition-colors duration-300 ${done ? 'bg-secondary-500 text-white' : current ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-400'}`}>{done ? <Check size={13} /> : i + 1}</span>
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${current ? 'text-brand-700' : done ? 'text-secondary-700' : 'text-stone-400'}`}>{label}</span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className="flex-1 h-1 mx-1.5 -mt-4 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-secondary-500 rounded-full transition-all duration-500 ease-out" style={{ width: i < stepIndex ? '100%' : '0%' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
