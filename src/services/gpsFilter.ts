import { SportType, TrackPoint } from '@/types';
import { haversineM } from '@/utils/geo';

/**
 * GPS reliability layer.
 *
 * Every raw fix passes through 4 gates before touching distance/pace/map:
 *  1. Accuracy gate   — drop fixes with poor horizontal accuracy.
 *  2. Speed gate      — drop fixes implying impossible speed for the sport.
 *  3. Jitter gate     — drop sub-meter wobble while standing still.
 *  4. Smoothing       — light EMA on lat/lng to remove zig-zag.
 */

const MAX_ACCURACY_M = 35;

const MAX_SPEED_M_S: Record<SportType, number> = {
  walk:     3.5,   // ~12.6 km/h
  hike:     3.5,
  run:      8.5,   // ~30.6 km/h (covers sprint finishes)
  ride:     25,    // 90 km/h descents
  cycling:  25,
  swim:     3,     // ~10.8 km/h (elite swimmer ~6)
  yoga:     1,     // essentially stationary
  workout:  5,     // indoor, minimal GPS movement
  hiit:     6,
  tennis:   10,    // quick lateral bursts
  other:    20,
};

/** Minimum movement to register a new point (anti-jitter). */
const MIN_STEP_M = 2;

/** Exponential smoothing factor: 1 = raw, lower = smoother. */
const SMOOTHING_ALPHA = 0.6;

export class GpsFilter {
  private lastAccepted: TrackPoint | null = null;
  private smoothedLat: number | null = null;
  private smoothedLng: number | null = null;

  constructor(private sport: SportType) {}

  reset(): void {
    this.lastAccepted = null;
    this.smoothedLat = null;
    this.smoothedLng = null;
  }

  setSport(sport: SportType): void {
    this.sport = sport;
  }

  process(raw: TrackPoint): TrackPoint | null {
    // 1. Accuracy gate
    if (raw.accuracy != null && raw.accuracy > MAX_ACCURACY_M) return null;

    if (this.lastAccepted) {
      const dt = (raw.timestamp - this.lastAccepted.timestamp) / 1000;
      if (dt <= 0) return null;

      const d = haversineM(
        this.lastAccepted.latitude, this.lastAccepted.longitude,
        raw.latitude, raw.longitude,
      );

      // 2. Speed gate
      const impliedSpeed = d / dt;
      if (impliedSpeed > MAX_SPEED_M_S[this.sport]) return null;

      // 3. Jitter gate
      if (d < MIN_STEP_M) return null;
    }

    // 4. Smoothing
    if (this.smoothedLat == null || this.smoothedLng == null) {
      this.smoothedLat = raw.latitude;
      this.smoothedLng = raw.longitude;
    } else {
      this.smoothedLat = SMOOTHING_ALPHA * raw.latitude + (1 - SMOOTHING_ALPHA) * this.smoothedLat;
      this.smoothedLng = SMOOTHING_ALPHA * raw.longitude + (1 - SMOOTHING_ALPHA) * this.smoothedLng;
    }

    const accepted: TrackPoint = {
      ...raw,
      latitude: this.smoothedLat,
      longitude: this.smoothedLng,
    };
    this.lastAccepted = accepted;
    return accepted;
  }
}

/**
 * Auto-pause detection: returns true when recent fixes indicate the
 * athlete is effectively stationary.
 */
export function isStationary(points: TrackPoint[], windowS = 8): boolean {
  if (points.length < 2) return false;
  const end = points[points.length - 1].timestamp;
  const recent = points.filter((p) => p.timestamp >= end - windowS * 1000);
  if (recent.length < 2) return false;

  const speeds = recent.map((p) => p.speed).filter((s): s is number => s != null);
  if (speeds.length >= 2) {
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return avg < 0.5;
  }
  const d = haversineM(
    recent[0].latitude, recent[0].longitude,
    recent[recent.length - 1].latitude, recent[recent.length - 1].longitude,
  );
  return d < 4;
}
