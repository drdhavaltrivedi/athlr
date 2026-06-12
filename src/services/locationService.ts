import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { TrackPoint } from '@/types';
import { useRecordingStore } from '@/store/recordingStore';

/**
 * Location service.
 *
 * Uses expo-location with a background task + Android foreground service so
 * recording survives the screen turning off. For production-grade battery
 * optimization and motion-API integration, swap this layer for
 * react-native-background-geolocation (Transistorsoft) — the public API of
 * this module is designed so that's a drop-in change.
 */

const TASK_NAME = 'athlr-location-task';

function toTrackPoint(loc: Location.LocationObject): TrackPoint {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude: loc.coords.altitude ?? null,
    accuracy: loc.coords.accuracy ?? null,
    speed: loc.coords.speed ?? null,
    timestamp: loc.timestamp,
  };
}

// Background task: receives batches of fixes while app is backgrounded.
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[location-task]', error.message);
    return;
  }
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  if (!locations?.length) return;
  const ingest = useRecordingStore.getState().ingest;
  for (const loc of locations) ingest(toTrackPoint(loc));
});

export async function requestPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { foreground: false, background: false, canAskAgainForeground: fg.canAskAgain };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.status === 'granted', canAskAgainForeground: fg.canAskAgain };
}

const FOREGROUND_SERVICE = {
  notificationTitle: 'Athlr is recording',
  notificationBody: 'Your activity is being tracked.',
  notificationColor: '#FFB020',
};

/** Full-accuracy profile used while actively recording. */
const ACTIVE_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 2,
  showsBackgroundLocationIndicator: true,
  // Android foreground service notification — required for reliable
  // background tracking and honest with the user about what's running.
  foregroundService: FOREGROUND_SERVICE,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
};

/**
 * Low-power profile for user-initiated pauses (coffee stop, traffic light
 * chat). Auto-pause does NOT use this — it needs fresh fixes to auto-resume.
 */
const PAUSED_OPTIONS: Location.LocationTaskOptions = {
  ...ACTIVE_OPTIONS,
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 5000,
  distanceInterval: 20,
};

export async function startTracking(): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(
    () => false,
  );
  if (already) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, ACTIVE_OPTIONS);
}

/**
 * Switch between the full-accuracy and low-power tracking profiles
 * without losing the background task. Call with true on manual pause,
 * false on resume.
 */
export async function setPausedProfile(paused: boolean): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(
    () => false,
  );
  if (!started) return;
  await Location.stopLocationUpdatesAsync(TASK_NAME);
  await Location.startLocationUpdatesAsync(
    TASK_NAME,
    paused ? PAUSED_OPTIONS : ACTIVE_OPTIONS,
  );
}

export async function stopTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(
    () => false,
  );
  if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
}

/**
 * Foreground accuracy watcher for the pre-start GPS indicator.
 * Only watches if permission is already granted (never prompts).
 * Returns null when unavailable; caller shows "GPS off" state.
 */
export async function watchAccuracy(
  cb: (accuracyM: number | null) => void,
): Promise<{ remove: () => void } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    return await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
      (loc) => cb(loc.coords.accuracy ?? null),
    );
  } catch {
    return null;
  }
}

/** One-shot fix to center the map before recording starts. */
export async function getCurrentPosition(): Promise<TrackPoint | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return toTrackPoint(loc);
  } catch {
    return null;
  }
}
