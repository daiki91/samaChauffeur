import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '@/types';

export function useLocation(enabled = true) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setError('Permission de localisation refusée');
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        subscription.current = await Location.watchPositionAsync(
          // Matches the background tracker's cadence (see backgroundLocation.ts) so the
          // foreground and background paths behave consistently for battery/network use.
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 25 },
          (loc) => {
            if (!cancelled) setPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          },
        );
      } catch {
        if (!cancelled) setError("Impossible d'obtenir la position");
      }
    })();

    return () => {
      cancelled = true;
      subscription.current?.remove();
    };
  }, [enabled]);

  return { position, error };
}
