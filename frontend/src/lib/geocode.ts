// Free geocoding via OpenStreetMap Nominatim — no API key required.
// Client-side demo usage: keep request volume low (debounced, limit=5).
// https://nominatim.org/release-docs/latest/api/Search/

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export type AddressResult = {
  label: string
  lat: number
  lng: number
}

export async function searchAddress(query: string, opts?: { near?: { lat: number; lng: number } }): Promise<AddressResult[]> {
  if (!query || query.trim().length < 3) return []

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '5',
    addressdetails: '0',
  })

  // Bias results toward the user's area when we know it, without hard-restricting.
  if (opts?.near) {
    const { lat, lng } = opts.near
    const delta = 2 // degrees, ~220km box
    params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`)
    params.set('bounded', '0')
  }

  const resp = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) return []
  const data = await resp.json()
  return (data || []).map((d: any) => ({
    label: d.display_name as string,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }))
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng) })
  try {
    const resp = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data?.display_name || null
  } catch {
    return null
  }
}
