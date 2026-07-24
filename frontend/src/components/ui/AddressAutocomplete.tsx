import { useEffect, useRef, useState } from 'react'
import { MapPin, LocateFixed, Loader2, AlertCircle } from 'lucide-react'
import { searchAddress, reverseGeocode, type AddressResult } from '../../lib/geocode'
import { getCurrentPosition, type LatLng } from '../../lib/useGeolocation'

type Props = {
  label?: string
  placeholder?: string
  value: string
  onChange: (text: string) => void
  onSelect: (result: AddressResult) => void
  near?: { lat: number; lng: number }
  allowMyLocation?: boolean
  /** Already-known live position (e.g. from a parent's useGeolocation watch) — used
   *  instantly instead of triggering a fresh, slower one-shot lookup when available. */
  currentPosition?: LatLng | null
}

export default function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  near,
  allowMyLocation,
  currentPosition,
}: Props) {
  const [results, setResults] = useState<AddressResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.trim().length < 3) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchAddress(value, near ? { near } : undefined)
        setResults(r)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const pick = (r: AddressResult) => {
    onSelect(r)
    setOpen(false)
    setResults([])
  }

  const useMyLocation = async () => {
    setLocating(true)
    setLocateError(null)
    try {
      // Prefer the already-tracked live position — instant and avoids a second
      // permission/GPS round-trip that can silently fail on some devices.
      const pos = currentPosition ?? (await getCurrentPosition())
      const label = (await reverseGeocode(pos.lat, pos.lng)) || `Ma position (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`
      pick({ label, lat: pos.lat, lng: pos.lng })
    } catch (err: any) {
      setLocateError(
        err?.code === 1
          ? "Localisation refusée — autorisez l'accès à votre position dans les réglages du navigateur."
          : "Impossible de récupérer votre position. Vérifiez que la localisation est activée.",
      )
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>}
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-9 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-stone-100 bg-white shadow-floating animate-fade-in-up">
          {results.map((r, i) => (
            <button
              type="button"
              key={i}
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-brand-50 border-b border-stone-50 last:border-0"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-brand-500" />
              <span className="text-stone-700 line-clamp-2">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {allowMyLocation && (
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-secondary-600 hover:text-secondary-700 disabled:opacity-50"
        >
          {locating ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
          Utiliser ma position actuelle
        </button>
      )}
      {locateError && (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {locateError}
        </p>
      )}
    </div>
  )
}
