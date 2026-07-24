// Free road routing via the public OSRM demo server — no API key required.
// https://project-osrm.org/docs/v5.24.0/api/#route-service

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export type Route = {
  /** [lat, lng] points, ready to feed a Leaflet <Polyline positions={...} /> */
  path: [number, number][]
  distanceKm: number
  durationMin: number
}

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<Route | null> {
  try {
    const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data = await resp.json()
    const route = data?.routes?.[0]
    if (!route) return null
    const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
    return {
      path: coords,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
  } catch {
    return null
  }
}
