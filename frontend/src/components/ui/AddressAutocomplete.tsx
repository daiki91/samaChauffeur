import { useEffect, useId, useRef, useState } from 'react'
import { MapPin, LocateFixed, Loader2, AlertCircle, Home, Briefcase, History, X } from 'lucide-react'
import { searchAddress, reverseGeocode, GeocodeError, type AddressResult } from '../../lib/geocode'
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
  const [searchError, setSearchError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState(getFavorites)
  const [recents, setRecents] = useState(getRecents)
  // Set while the user is searching specifically to save the next pick as Home/Work.
  const [pendingFavoriteSlot, setPendingFavoriteSlot] = useState<FavoriteSlot | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
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
      setSearchError(null)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      // Cancel whatever search is still in flight — a fast typer can otherwise get an older,
      // slower response landing after a newer one and silently overwriting it.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const r = await searchAddress(value, { ...(near ? { near } : undefined), signal: controller.signal })
        setResults(r)
        setSearchError(null)
        setOpen(true)
      } catch (err) {
        if (controller.signal.aborted) return // superseded by a newer search
        setResults([])
        setSearchError(err instanceof GeocodeError ? "Recherche d'adresse indisponible pour le moment." : 'Erreur de recherche.')
      } finally {
        if (abortRef.current === controller) setSearching(false)
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

  const showFavorites = open && value.trim().length < 3
  const showResults = open && results.length > 0

  // A flat, keyboard-navigable list matching whichever dropdown is currently shown — arrow
  // keys move through it, Enter picks the highlighted entry, regardless of which section it's in.
  type NavItem = { kind: 'favorite'; slot: FavoriteSlot } | { kind: 'address'; result: AddressResult }
  const navItems: NavItem[] = showFavorites
    ? [...(['home', 'work'] as FavoriteSlot[]).map((slot) => ({ kind: 'favorite' as const, slot })), ...recents.map((r) => ({ kind: 'address' as const, result: r }))]
    : showResults
      ? results.map((r) => ({ kind: 'address' as const, result: r }))
      : []

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [results, open, value])

  useEffect(() => {
    if (highlightedIndex < 0) return
    document.getElementById(`${listboxId}-option-${highlightedIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, listboxId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
      return
    }
    if (!open || navItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i + 1) % navItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i <= 0 ? navItems.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      const item = navItems[highlightedIndex]
      if (item.kind === 'favorite') pickFavoriteSlot(item.slot)
      else pick(item.result)
    }
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
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showFavorites || showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        />
        {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 animate-spin" />}
      </div>

      {searchError && !searching && (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {searchError}
        </p>
      )}

      {showFavorites && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-stone-100 bg-white shadow-floating animate-fade-in-up">
          {(['home', 'work'] as FavoriteSlot[]).map((slot, slotIndex) => {
            const meta = FAVORITE_META[slot]
            const place = favorites[slot]
            const Icon = meta.icon
            const highlighted = highlightedIndex === slotIndex
            return (
              <div key={slot} className="group flex items-center border-b border-stone-50 last:border-0">
                <button
                  type="button"
                  id={`${listboxId}-option-${slotIndex}`}
                  role="option"
                  aria-selected={highlighted}
                  onClick={() => pickFavoriteSlot(slot)}
                  className={`flex-1 flex items-center gap-2.5 px-3.5 py-2.5 text-left min-w-0 ${highlighted ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
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
          {recents.map((r, i) => {
            const navIndex = 2 + i
            const highlighted = highlightedIndex === navIndex
            return (
              <button
                key={i}
                type="button"
                id={`${listboxId}-option-${navIndex}`}
                role="option"
                aria-selected={highlighted}
                onClick={() => pick(r)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left border-b border-stone-50 last:border-0 ${highlighted ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
              >
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-stone-50 text-stone-400 shrink-0">
                  <History size={15} />
                </span>
                <span className="text-sm text-stone-700 truncate">{r.label}</span>
              </button>
            )
          })}
          {pendingFavoriteSlot && (
            <div className="px-3.5 py-2 text-xs text-brand-600 bg-brand-50/60">
              Recherchez une adresse à enregistrer comme {FAVORITE_META[pendingFavoriteSlot].label.toLowerCase()}…
            </div>
          )}
        </div>
      )}

      {showResults && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-stone-100 bg-white shadow-floating animate-fade-in-up">
          {results.map((r, i) => {
            const highlighted = highlightedIndex === i
            return (
              <button
                type="button"
                key={i}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={highlighted}
                onClick={() => pick(r)}
                className={`flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm border-b border-stone-50 last:border-0 ${highlighted ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-500" />
                <span className="text-stone-700 line-clamp-2">{r.label}</span>
              </button>
            )
          })}
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
