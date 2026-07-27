export type FavoriteSlot = 'home' | 'work'

export type Place = { label: string; lat: number; lng: number }

type FavoritesStore = Partial<Record<FavoriteSlot, Place>>

const FAVORITES_KEY = 'fav_places'
const RECENTS_KEY = 'recent_places'
const MAX_RECENTS = 4

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function getFavorites(): FavoritesStore {
  return readJson<FavoritesStore>(FAVORITES_KEY, {})
}

export function setFavorite(slot: FavoriteSlot, place: Place) {
  const all = getFavorites()
  all[slot] = place
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(all))
}

export function removeFavorite(slot: FavoriteSlot) {
  const all = getFavorites()
  delete all[slot]
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(all))
}

export function getRecents(): Place[] {
  return readJson<Place[]>(RECENTS_KEY, [])
}

/** Records a place as recently used, most-recent-first, deduped by label, capped at MAX_RECENTS. */
export function addRecent(place: Place) {
  if (!place.label) return
  const existing = getRecents().filter((p) => p.label !== place.label)
  const next = [place, ...existing].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
}
