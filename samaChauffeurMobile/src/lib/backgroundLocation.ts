import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { Socket } from 'socket.io-client';
import { updateLocation } from './api';

/**
 * Background driver location tracking (Expo Location + TaskManager).
 *
 * `expo-task-manager` requires the task to be defined at module scope so it can be
 * re-registered by the OS even when the JS bundle is (re)loaded to handle a background
 * location update — hence this file is imported once, early, from src/app/_layout.tsx.
 *
 * Background JS execution can't reliably keep a live socket connection open, so we try
 * the existing driver socket first (best case: instant update while the app is merely
 * backgrounded, not killed) and always fall back to the REST endpoint, which is the
 * reliable path when the process was woken up just for this location update.
 */

export const BACKGROUND_LOCATION_TASK = 'samachauffeur-driver-background-location';

// Set by whichever screen owns the live driver socket (DriverHome), so the background
// task can piggyback on it when it's available and connected.
let activeSocket: Socket | null = null;

export function setBackgroundLocationSocket(socket: Socket | null) {
  activeSocket = socket;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;

  const { latitude, longitude } = last.coords;

  if (activeSocket?.connected) {
    activeSocket.emit('location.update', { lat: latitude, lng: longitude });
    return;
  }

  try {
    await updateLocation(latitude, longitude);
  } catch {
    // best-effort — the next background tick will retry with a fresher position anyway
  }
});

export async function startBackgroundLocationTracking() {
  try {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (alreadyStarted) return;

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return;

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') return;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 8000,
      distanceInterval: 25,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'samaChauffeur',
        notificationBody: 'Partage de votre position en cours pendant que vous êtes en ligne.',
      },
    });
  } catch {
    // e.g. background location unavailable in this runtime (Expo Go, simulator) — ignore
  }
}

export async function stopBackgroundLocationTracking() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (!started) return;
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // ignore — nothing to stop
  }
}
