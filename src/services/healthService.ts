/**
 * healthService.ts
 *
 * Unified abstraction over:
 *   iOS  → Apple HealthKit  (react-native-health)
 *   Android → Health Connect (react-native-health-connect)
 *
 * Both are the "hub" that all fitness devices/apps write to:
 *   Apple Watch  ──► HealthKit ──► Athlr
 *   Garmin/Fitbit ──► HealthKit / Health Connect ──► Athlr
 *   Wear OS Watch ──► Health Connect ──► Athlr
 *   Google Fit ──► Health Connect ──► Athlr
 *
 * Call initialize() once at app start.
 * Call importWorkouts() to pull new workouts from the platform.
 */

import { Platform } from 'react-native';
import { Activity, SportType, TrackPoint } from '@/types';

// ─── iOS: HealthKit ───────────────────────────────────────────────────────────
// react-native-health
let AppleHealthKit: any = null;
let HKPermissions: any = null;

if (Platform.OS === 'ios') {
  try {
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod;
    HKPermissions = mod.HealthInputTypes ?? mod.HealthKitPermissions;
  } catch {
    // not linked – dev build required
  }
}

// ─── Android: Health Connect ──────────────────────────────────────────────────
// react-native-health-connect
let HC: any = null;

if (Platform.OS === 'android') {
  try {
    HC = require('react-native-health-connect');
  } catch {
    // not linked
  }
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export type HealthSource = 'apple_health' | 'health_connect' | 'manual';

export interface ImportedWorkout {
  /** Unique ID from the source platform (used to de-duplicate). */
  sourceId: string;
  source: HealthSource;
  sport: SportType;
  title: string;
  startedAt: number;    // unix ms
  endedAt: number;      // unix ms
  durationS: number;
  distanceM: number;
  elevationGainM: number;
  avgHeartRate: number | null;
  calories: number | null;
  /** GPS route — populated if the platform provides it (Apple Watch always does). */
  points: TrackPoint[];
}

// ─── Sport mapping ────────────────────────────────────────────────────────────

/** HealthKit workout activity type codes → Athlr SportType */
const HK_SPORT_MAP: Record<number, SportType> = {
  37: 'run',        // HKWorkoutActivityTypeRunning
  13: 'ride',       // HKWorkoutActivityTypeCycling
  52: 'walk',       // HKWorkoutActivityTypeWalking
  24: 'hike',       // HKWorkoutActivityTypeHiking
  46: 'swim',       // HKWorkoutActivityTypeSwimming
  20: 'hiit',       // HKWorkoutActivityTypeHighIntensityIntervalTraining
  100: 'yoga',      // HKWorkoutActivityTypeYoga
  50: 'workout',    // HKWorkoutActivityTypeTraditionalStrengthTraining
  16: 'workout',    // HKWorkoutActivityTypeFunctionalStrengthTraining
  38: 'tennis',     // HKWorkoutActivityTypeTennis
};

/** Health Connect exercise type codes → Athlr SportType */
const HC_SPORT_MAP: Record<number, SportType> = {
  79: 'run',        // EXERCISE_TYPE_RUNNING
  8:  'ride',       // EXERCISE_TYPE_BIKING
  78: 'ride',       // EXERCISE_TYPE_ROAD_BIKING
  56: 'walk',       // EXERCISE_TYPE_WALKING
  37: 'hike',       // EXERCISE_TYPE_HIKING
  82: 'swim',       // EXERCISE_TYPE_SWIMMING_OPEN_WATER
  83: 'swim',       // EXERCISE_TYPE_SWIMMING_POOL
  64: 'hiit',       // EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
  61: 'yoga',       // EXERCISE_TYPE_YOGA
  80: 'workout',    // EXERCISE_TYPE_STRENGTH_TRAINING
  93: 'tennis',     // EXERCISE_TYPE_TENNIS
  50: 'cycling',    // EXERCISE_TYPE_EXERCISE_BIKING
};

function hkSport(code: number): SportType {
  return HK_SPORT_MAP[code] ?? 'other';
}

function hcSport(code: number): SportType {
  return HC_SPORT_MAP[code] ?? 'other';
}

// ─── iOS — HealthKit ──────────────────────────────────────────────────────────

const HK_PERMISSIONS = {
  permissions: {
    read: [
      'Workout',
      'HeartRate',
      'DistanceWalkingRunning',
      'DistanceCycling',
      'DistanceSwimming',
      'FlightsClimbed',
      'ActiveEnergyBurned',
      'StepCount',
    ],
    write: ['Workout'],
  },
};

let hkInitialized = false;

async function initializeHK(): Promise<boolean> {
  if (!AppleHealthKit) return false;
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(HK_PERMISSIONS, (err: unknown) => {
      if (err) { resolve(false); return; }
      hkInitialized = true;
      resolve(true);
    });
  });
}

async function importFromHealthKit(since: Date): Promise<ImportedWorkout[]> {
  if (!AppleHealthKit || !hkInitialized) return [];

  const workouts: any[] = await new Promise<any[]>((resolve, reject) => {
    AppleHealthKit.getSamples(
      {
        startDate: since.toISOString(),
        endDate: new Date().toISOString(),
        type: 'Workout',
      },
      (err: any, results: any[]) => {
        if (err) reject(err);
        else resolve(results ?? []);
      },
    );
  }).catch(() => [] as any[]);

  const imported: ImportedWorkout[] = [];

  for (const w of workouts) {
    // Fetch heart rate samples for this workout's time window
    const hrSamples: any[] = await new Promise<any[]>((res) => {
      AppleHealthKit.getHeartRateSamples(
        { startDate: w.start, endDate: w.end },
        (err: any, r: any[]) => res(r ?? []),
      );
    }).catch(() => []);

    const avgHR =
      hrSamples.length > 0
        ? Math.round(
            hrSamples.reduce((s: number, h: any) => s + h.value, 0) /
              hrSamples.length,
          )
        : null;

    // Fetch GPS route (Apple Watch workouts include route data via HKWorkoutRoute)
    const routeSamples: any[] = await new Promise<any[]>((res) => {
      try {
        AppleHealthKit.getWorkoutRouteSamples?.(
          { startDate: w.start, endDate: w.end, id: w.id },
          (err: any, r: any[]) => res(r ?? []),
        );
      } catch {
        res([]);
      }
    }).catch(() => []);

    const points: TrackPoint[] = routeSamples.map((r: any) => ({
      latitude: r.latitude,
      longitude: r.longitude,
      altitude: r.altitude ?? null,
      accuracy: null,
      speed: null,
      timestamp: new Date(r.timestamp).getTime(),
    }));

    const sport = hkSport(w.activityType ?? 0);

    imported.push({
      sourceId: w.id ?? `hk_${w.start}`,
      source: 'apple_health',
      sport,
      title: w.sourceName
        ? `${w.sourceName} ${sport}`
        : `${sport.charAt(0).toUpperCase() + sport.slice(1)}`,
      startedAt: new Date(w.start).getTime(),
      endedAt: new Date(w.end).getTime(),
      durationS: Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000),
      distanceM: Math.round((w.distance ?? 0) * 1000),  // HK returns km
      elevationGainM: Math.round(w.elevationAscended ?? 0),
      avgHeartRate: avgHR,
      calories: w.calories ? Math.round(w.calories) : null,
      points,
    });
  }

  return imported;
}

// ─── Android — Health Connect ─────────────────────────────────────────────────

const HC_READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ElevationGained' },
  { accessType: 'read', recordType: 'Speed' },
];

async function initializeHC(): Promise<boolean> {
  if (!HC) return false;
  try {
    const available = await HC.getSdkStatus?.();
    // 3 = SDK_AVAILABLE on Health Connect
    if (available !== 3 && available !== 'SdkAvailable') return false;
    const result = await HC.initialize?.();
    return result === true || result?.granted === true;
  } catch {
    return false;
  }
}

async function requestHCPermissions(): Promise<boolean> {
  if (!HC) return false;
  try {
    const granted = await HC.requestPermission?.(HC_READ_PERMISSIONS);
    return Array.isArray(granted) && granted.length > 0;
  } catch {
    return false;
  }
}

async function importFromHealthConnect(since: Date): Promise<ImportedWorkout[]> {
  if (!HC) return [];

  try {
    const sessions = await HC.readRecords?.('ExerciseSession', {
      timeRangeFilter: {
        operator: 'after',
        startTime: since.toISOString(),
      },
    });

    const records: any[] = sessions?.records ?? [];
    const imported: ImportedWorkout[] = [];

    for (const s of records) {
      // Fetch heart rate in this session's window
      const hrRecords = await HC.readRecords?.('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: s.startTime,
          endTime: s.endTime,
        },
      }).catch(() => ({ records: [] }));

      const hrSamples: number[] = (hrRecords?.records ?? []).flatMap(
        (r: any) => (r.samples ?? []).map((ss: any) => ss.beatsPerMinute),
      );
      const avgHR =
        hrSamples.length > 0
          ? Math.round(hrSamples.reduce((a: number, b: number) => a + b, 0) / hrSamples.length)
          : null;

      // Distance
      const distRecords = await HC.readRecords?.('Distance', {
        timeRangeFilter: {
          operator: 'between',
          startTime: s.startTime,
          endTime: s.endTime,
        },
      }).catch(() => ({ records: [] }));
      const totalDistM = (distRecords?.records ?? []).reduce(
        (sum: number, r: any) => sum + (r.distance?.inMeters ?? 0),
        0,
      );

      // Elevation
      const elevRecords = await HC.readRecords?.('ElevationGained', {
        timeRangeFilter: {
          operator: 'between',
          startTime: s.startTime,
          endTime: s.endTime,
        },
      }).catch(() => ({ records: [] }));
      const totalElevM = (elevRecords?.records ?? []).reduce(
        (sum: number, r: any) => sum + (r.elevation?.inMeters ?? 0),
        0,
      );

      // Calories
      const calRecords = await HC.readRecords?.('TotalCaloriesBurned', {
        timeRangeFilter: {
          operator: 'between',
          startTime: s.startTime,
          endTime: s.endTime,
        },
      }).catch(() => ({ records: [] }));
      const totalCal = (calRecords?.records ?? []).reduce(
        (sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0),
        0,
      );

      const startMs = new Date(s.startTime).getTime();
      const endMs = new Date(s.endTime).getTime();
      const sport = hcSport(s.exerciseType ?? 0);

      imported.push({
        sourceId: s.metadata?.id ?? `hc_${s.startTime}`,
        source: 'health_connect',
        sport,
        title: s.title || `${sport.charAt(0).toUpperCase() + sport.slice(1)}`,
        startedAt: startMs,
        endedAt: endMs,
        durationS: Math.round((endMs - startMs) / 1000),
        distanceM: Math.round(totalDistM),
        elevationGainM: Math.round(totalElevM),
        avgHeartRate: avgHR,
        calories: totalCal > 0 ? Math.round(totalCal) : null,
        points: [],   // Health Connect does not expose route GPS in v1 API
      });
    }

    return imported;
  } catch {
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface HealthServiceStatus {
  available: boolean;
  platform: 'ios' | 'android' | 'none';
  authorized: boolean;
}

let _status: HealthServiceStatus = {
  available: false,
  platform: 'none',
  authorized: false,
};

export async function initialize(): Promise<HealthServiceStatus> {
  if (Platform.OS === 'ios') {
    const ok = await initializeHK();
    _status = { available: !!AppleHealthKit, platform: 'ios', authorized: ok };
  } else if (Platform.OS === 'android') {
    const ok = await initializeHC();
    _status = { available: !!HC, platform: 'android', authorized: ok };
  }
  return _status;
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return initializeHK();
  } else if (Platform.OS === 'android') {
    return requestHCPermissions();
  }
  return false;
}

export function getStatus(): HealthServiceStatus {
  return _status;
}

/**
 * Pull all workouts since `since` from the platform health store.
 * Returns a list of ImportedWorkout objects ready to be converted to Activity.
 */
export async function importWorkouts(since: Date): Promise<ImportedWorkout[]> {
  if (Platform.OS === 'ios') return importFromHealthKit(since);
  if (Platform.OS === 'android') return importFromHealthConnect(since);
  return [];
}

/**
 * Convert an ImportedWorkout to an Activity that can be saved to SQLite.
 * Splits are computed from GPS points when available.
 */
export function toActivity(w: ImportedWorkout): Activity {
  const { computeSplits } = require('@/utils/geo');
  return {
    id: `imported_${w.sourceId}`,
    sport: w.sport,
    title: w.title,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    elapsedS: w.durationS,
    movingS: w.durationS,
    distanceM: w.distanceM,
    elevationGainM: w.elevationGainM,
    avgPaceSPerKm:
      w.distanceM > 10
        ? Math.round(w.durationS / (w.distanceM / 1000))
        : 0,
    visibility: 'private',
    points: w.points,
    splits: w.points.length > 2 ? computeSplits(w.points) : [],
  };
}
