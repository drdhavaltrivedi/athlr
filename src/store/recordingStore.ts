import { create } from 'zustand';
import { Activity, RecordingSnapshot, SportType, TrackPoint, Units } from '@/types';
import { GpsFilter, isStationary } from '@/services/gpsFilter';
import {
  computeSplits,
  haversineM,
  rollingPaceSPerKm,
} from '@/utils/geo';
import { saveActivity } from '@/db/database';
import { notifyWarning, tapMedium } from '@/utils/haptics';

interface RecordingState extends RecordingSnapshot {
  autoPause: boolean;
  units: Units;
  displayName: string;
  /** Who paused: auto-pause keeps listening to GPS and resumes by itself. */
  pausedBy: 'user' | 'auto' | null;
  /** internal: last tick timestamp for the elapsed clock */
  _lastTickMs: number | null;
  _filter: GpsFilter;

  setSport: (s: SportType) => void;
  setAutoPause: (v: boolean) => void;
  setUnits: (u: Units) => void;
  setDisplayName: (name: string) => void;
  start: () => void;
  pause: (manual?: boolean) => void;
  resume: () => void;
  /** Called every second by the UI timer while recording. */
  tick: () => void;
  /** Feed a raw GPS fix from the location service. */
  ingest: (raw: TrackPoint) => void;
  /** Stop, persist, and return the saved activity (or null if too short). */
  finish: () => Promise<Activity | null>;
  discard: () => void;
}

const initial: RecordingSnapshot & { autoPause: boolean; units: Units; displayName: string; pausedBy: 'user' | 'auto' | null } = {
  state: 'idle',
  sport: 'run',
  startedAt: null,
  elapsedS: 0,
  movingS: 0,
  distanceM: 0,
  elevationGainM: 0,
  currentPaceSPerKm: null,
  points: [],
  autoPause: true,
  units: 'km',
  displayName: '',
  pausedBy: null,
};

export const useRecordingStore = create<RecordingState>((set, get) => ({
  ...initial,
  _lastTickMs: null,
  _filter: new GpsFilter('run'),

  setSport: (sport) => {
    get()._filter.setSport(sport);
    set({ sport });
  },

  setAutoPause: (autoPause) => set({ autoPause }),
  setUnits: (units) => set({ units }),
  setDisplayName: (displayName) => set({ displayName }),

  start: () => {
    get()._filter.reset();
    set({
      ...initial,
      sport: get().sport,
      autoPause: get().autoPause,
      units: get().units,
      displayName: get().displayName,
      state: 'recording',
      startedAt: Date.now(),
      _lastTickMs: Date.now(),
    });
  },

  pause: () => set({ state: 'paused', pausedBy: 'user' }),

  resume: () => set({ state: 'recording', pausedBy: null, _lastTickMs: Date.now() }),

  tick: () => {
    const s = get();
    if (s.state === 'idle' || s.startedAt == null) return;
    const now = Date.now();
    const dt = s._lastTickMs ? (now - s._lastTickMs) / 1000 : 1;
    set({
      // Elapsed is wall-clock from start — it keeps counting through pauses
      elapsedS: (now - s.startedAt) / 1000,
      // Moving time accumulates only while actually recording
      movingS: s.state === 'recording' ? s.movingS + dt : s.movingS,
      _lastTickMs: now,
    });
  },

  ingest: (raw) => {
    let s = get();

    // Auto-resume: while auto-paused we keep listening to raw fixes and
    // restart the clock as soon as the athlete is clearly moving again.
    // (User-initiated pauses are sacred — only the user resumes those.)
    if (s.state === 'paused' && s.pausedBy === 'auto') {
      const last = s.points[s.points.length - 1];
      const goodFix = (raw.accuracy ?? 99) < 30;
      const movedM = last
        ? haversineM(last.latitude, last.longitude, raw.latitude, raw.longitude)
        : 0;
      const isMoving =
        (raw.speed != null && raw.speed > 1.2) || (goodFix && movedM > 12);
      if (!isMoving) return;
      set({ state: 'recording', pausedBy: null, _lastTickMs: Date.now() });
      tapMedium(); // let the athlete feel the auto-resume
      s = get();
    }

    if (s.state !== 'recording') return;

    const point = s._filter.process(raw);
    if (!point) return;

    const points = [...s.points, point];
    let distanceM = s.distanceM;
    let elevGain = s.elevationGainM;
    if (s.points.length > 0) {
      const prev = s.points[s.points.length - 1];
      distanceM += haversineM(prev.latitude, prev.longitude, point.latitude, point.longitude);
      // Incremental elevation: only compare the new point to its predecessor
      // (avoids re-scanning all points — O(1) instead of O(n))
      if (point.altitude != null && prev.altitude != null) {
        const gain = point.altitude - prev.altitude;
        if (gain > 3) elevGain += gain; // same threshold as elevationGainM()
      }
    }

    set({
      points,
      distanceM,
      elevationGainM: elevGain,
      currentPaceSPerKm: rollingPaceSPerKm(points),
    });

    if (s.autoPause && isStationary(points)) {
      set({ state: 'paused', pausedBy: 'auto' });
      notifyWarning(); // …and the auto-pause
    }
  },

  finish: async () => {
    const s = get();
    if (s.startedAt == null) return null;

    // Guard against accidental taps: require ~50m or 30s
    if (s.distanceM < 50 && s.elapsedS < 30) {
      get().discard();
      return null;
    }

    const activity: Activity = {
      id: `act_${s.startedAt}_${Math.random().toString(36).slice(2, 8)}`,
      sport: s.sport,
      title: defaultTitle(s.sport, s.startedAt),
      startedAt: s.startedAt,
      endedAt: Date.now(),
      elapsedS: Math.round(s.elapsedS),
      movingS: Math.round(s.movingS),
      distanceM: Math.round(s.distanceM),
      elevationGainM: Math.round(s.elevationGainM),
      avgPaceSPerKm:
        s.distanceM > 10 ? Math.round(s.movingS / (s.distanceM / 1000)) : 0,
      visibility: 'private',
      points: s.points,
      splits: computeSplits(s.points),
    };

    await saveActivity(activity);
    set({ ...initial, sport: s.sport, autoPause: s.autoPause, units: s.units, displayName: s.displayName, _lastTickMs: null });
    return activity;
  },

  discard: () => {
    const s = get();
    set({ ...initial, sport: s.sport, autoPause: s.autoPause, units: s.units, displayName: s.displayName, _lastTickMs: null });
  },
}));

function defaultTitle(sport: SportType, startedAt: number): string {
  const h = new Date(startedAt).getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  const name: Record<SportType, string> = {
    run:     'Run',
    ride:    'Ride',
    walk:    'Walk',
    hike:    'Hike',
    swim:    'Swim',
    yoga:    'Yoga',
    workout: 'Workout',
    hiit:    'HIIT Session',
    cycling: 'Cycling Ride',
    tennis:  'Tennis Match',
    other:   'Activity',
  };
  return `${part} ${name[sport]}`;
}
