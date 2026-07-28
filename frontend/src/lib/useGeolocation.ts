import { useEffect, useRef, useState } from 'react'

export type LatLng = { lat: number; lng: number }

/**
 * Continuously tracks the browser's real GPS position using the Geolocation API
 * (navigator.geolocation.watchPosition). Used to replace the old "random demo
 * position" button with an actual live location feed.
 */
export function useGeolocation(options?: { enabled?: boolean; highAccuracy?: boolean }) {
  const enabled = options?.enabled ?? true
  const [position, setPosition] = useState<LatLng | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!('geolocation' in navigator)) {
      setError("La géolocalisation n'est pas disponible sur cet appareil/navigateur.")
      setLoading(false)
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setAccuracy(pos.coords.accuracy)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Localisation refusée — autorisez l\'accès à votre position dans le navigateur.'
            : 'Impossible de récupérer votre position pour le moment.',
        )
        setLoading(false)
      },
      { enableHighAccuracy: options?.highAccuracy ?? true, maximumAge: 5000, timeout: 15000 },
    )

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { position, accuracy, error, loading }
}

/** One-shot position lookup, e.g. for a "use my current location" button. */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("Géolocalisation non disponible"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  })
}
