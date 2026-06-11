import { create } from 'zustand';
import { Activity, RecordingSnapshot, SportType, TrackPoint } from '@/types';
import { GpsFilter, isStationary } from '@/services/gpsFilter';
import {
  computeSplits,
  elevationGainM,
  haversineM,
  rollingPaceSPerKm,
} from '@/utils/geo';
import { saveActivity } from '@/db/database';

interface RecordingState extends RecordingSnapshot {
  autoPause: boolean;
  /** internal: last tick timestamp for the elapsed clock */
  _lastTickMs: number | null;
  _filter: GpsFilter;

  setSport: (s: SportType) => void;
  setAutoPause: (v: boolean) => void;
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

const initial: RecordingSnapshot & { autoPause: boolean } = {
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

  start: () => {
    get()._filter.reset();
    set({
      ...initial,
      sport: get().sport,
      autoPause: get().autoPause,
      state: 'recording',
      startedAt: Date.now(),
      _lastTickMs: Date.now(),
    });
  },

  pause: () => set({ state: 'paused', _lastTickMs: null }),

  resume: () => set({ state: 'recording', _lastTickMs: Date.now() }),

  tick: () => {
    const s = get();
    if (s.state !== 'recording') return;
    const now = Date.now();
    const dt = s._lastTickMs ? (now - s._lastTickMs) / 1000 : 1;
    set({
      elapsedS: s.elapsedS + dt,
      movingS: s.movingS + dt,
      _lastTickMs: now,
    });
  },

  ingest: (raw) => {
    const s = get();
    if (s.state !== 'recording') return;

    const point = s._filter.process(raw);
    if (!point) return;

    const points = [...s.points, point];
    let distanceM = s.distanceM;
    if (s.points.length > 0) {
      const prev = s.points[s.points.length - 1];
      distanceM += haversineM(prev.latitude, prev.longitude, point.latitude, point.longitude);
    }

    set({
      points,
      distanceM,
      elevationGainM: elevationGainM(points),
      currentPaceSPerKm: rollingPaceSPerKm(points),
    });

    // Auto-pause: stationary for a while -> pause; resume handled by movement
    if (s.autoPause && isStationary(points)) {
      set({ state: 'paused', _lastTickMs: null });
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
      visibility: 'private', // private by default — our core promise
      points: s.points,
      splits: computeSplits(s.points),
    };

    await saveActivity(activity);
    set({ ...initial, sport: s.sport, autoPause: s.autoPause, _lastTickMs: null });
    return activity;
  },

  discard: () => {
    const s = get();
    set({ ...initial, sport: s.sport, autoPause: s.autoPause, _lastTickMs: null });
  },
}));

function defaultTitle(sport: SportType, startedAt: number): string {
  const h = new Date(startedAt).getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  const name: Record<SportType, string> = {
    run: 'Run',
    ride: 'Ride',
    walk: 'Walk',
    hike: 'Hike',
  };
  return `${part} ${name[sport]}`;
}
