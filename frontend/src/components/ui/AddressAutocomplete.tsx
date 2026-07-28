import { useEffect, useRef, useState } from 'react'
import { MapPin, LocateFixed, Loader2, AlertCircle, Home, Briefcase, History, X } from 'lucide-react'
import { searchAddress, reverseGeocode, type AddressResult } from '../../lib/geocode'
import { getCurrentPosition, type LatLng } from '../../lib/useGeolocation'
import { getFavorites, setFavorite, removeFavorite, getRecents, type FavoriteSlot } from '../../lib/favorites'

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
  const [favorites, setFavorites] = useState(getFavorites)
  const [recents, setRecents] = useState(getRecents)
  // Set while the user is searching specifically to save the next pick as Home/Work.
  const [pendingFavoriteSlot, setPendingFavoriteSlot] = useState<FavoriteSlot | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Prevents the search effect from re-querying (and silently reopening the dropdown ~350ms
  // later) using the full label text that a pick/favorite/geolocation selection just wrote
  // into the field — that text isn't something the user typed to search for.
  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setPendingFavoriteSlot(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const pick = (r: AddressResult) => {
    if (pendingFavoriteSlot) {
      setFavorite(pendingFavoriteSlot, { label: r.label, lat: r.lat, lng: r.lng })
      setFavorites(getFavorites())
      setPendingFavoriteSlot(null)
    }
    skipNextSearchRef.current = true
    onSelect(r)
    setOpen(false)
    setResults([])
  }

  const pickFavoriteSlot = (slot: FavoriteSlot) => {
    const place = favorites[slot]
    if (place) {
      pick(place)
    } else {
      // Nothing saved yet for this slot — let the user search normally, and save
      // whatever they pick next as this favorite.
      setPendingFavoriteSlot(slot)
      onChange('')
    }
  }

  const clearFavorite = (e: React.MouseEvent, slot: FavoriteSlot) => {
    e.stopPropagation()
    removeFavorite(slot)
    setFavorites(getFavorites())
  }

  const FAVORITE_META: Record<FavoriteSlot, { label: string; icon: typeof Home }> = {
    home: { label: 'Domicile', icon: Home },
    work: { label: 'Travail', icon: Briefcase },
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
          onFocus={() => {
            setFavorites(getFavorites())
            setRecents(getRecents())
            setOpen(true)
          }}
        />
        {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 animate-spin" />}
      </div>

      {open && value.trim().length < 3 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-stone-100 bg-white shadow-floating animate-fade-in-up overflow-hidden">
          {(['home', 'work'] as FavoriteSlot[]).map((slot) => {
            const meta = FAVORITE_META[slot]
            const place = favorites[slot]
            const Icon = meta.icon
            return (
              <div key={slot} className="group flex items-center border-b border-stone-50 last:border-0">
                <button
                  type="button"
                  onClick={() => pickFavoriteSlot(slot)}
                  className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-brand-50 min-w-0"
                >
                  <span
                    className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${place ? 'bg-brand-50 text-brand-600' : 'bg-stone-50 text-stone-400'}`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-stone-800">{meta.label}</span>
                    <span className="block text-xs text-stone-400 truncate">{place ? place.label : 'Ajouter une adresse'}</span>
                  </span>
                </button>
                {place && (
                  <button
                    type="button"
                    onClick={(e) => clearFavorite(e, slot)}
                    className="px-2.5 self-stretch grid place-items-center text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Retirer ${meta.label}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )
          })}
          {recents.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(r)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-brand-50 border-b border-stone-50 last:border-0"
            >
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-stone-50 text-stone-400 shrink-0">
                <History size={15} />
              </span>
              <span className="text-sm text-stone-700 truncate">{r.label}</span>
            </button>
          ))}
          {pendingFavoriteSlot && (
            <div className="px-3.5 py-2 text-xs text-brand-600 bg-brand-50/60">
              Recherchez une adresse à enregistrer comme {FAVORITE_META[pendingFavoriteSlot].label.toLowerCase()}…
            </div>
          )}
        </div>
      )}

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
