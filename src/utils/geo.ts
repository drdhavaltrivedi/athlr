import { Split, TrackPoint } from '@/types';

const EARTH_RADIUS_M = 6371008.8;

/** Great-circle distance between two points in meters. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Total distance over an ordered point list, meters. */
export function totalDistanceM(points: TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineM(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude,
    );
  }
  return d;
}

/**
 * Elevation gain with a noise threshold. GPS altitude jitters by several
 * meters; we only count climbs once accumulated ascent exceeds the
 * threshold, which is how most sports watches do it.
 */
export function elevationGainM(points: TrackPoint[], thresholdM = 3): number {
  let gain = 0;
  let pending = 0;
  let last: number | null = null;
  for (const p of points) {
    if (p.altitude == null) continue;
    if (last != null) {
      const delta = p.altitude - last;
      if (delta > 0) {
        pending += delta;
        if (pending >= thresholdM) {
          gain += pending;
          pending = 0;
        }
      } else if (delta < -1) {
        pending = 0;
      }
    }
    last = p.altitude;
  }
  return gain;
}

/** Seconds-per-km pace from distance and duration. Returns null if too slow/short. */
export function paceSPerKm(distanceM: number, durationS: number): number | null {
  if (distanceM < 10 || durationS <= 0) return null;
  const pace = durationS / (distanceM / 1000);
  // Filter out absurd paces (> 30 min/km means effectively stationary)
  return pace > 1800 ? null : pace;
}

/**
 * Compute per-kilometer splits from a track.
 * Uses point timestamps, so paused gaps should already be excluded
 * from the track (the recorder does not append points while paused).
 */
export function computeSplits(points: TrackPoint[], splitDistanceM = 1000): Split[] {
  const splits: Split[] = [];
  if (points.length < 2) return splits;

  let index = 1;
  let segDistance = 0;
  let segStartTime = points[0].timestamp;
  let segElevGainPoints: TrackPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    segDistance += haversineM(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
    segElevGainPoints.push(cur);

    if (segDistance >= splitDistanceM) {
      const durationS = (cur.timestamp - segStartTime) / 1000;
      splits.push({
        index,
        distanceM: segDistance,
        durationS,
        paceSPerKm: durationS / (segDistance / 1000),
        elevationGainM: elevationGainM(segElevGainPoints),
      });
      index += 1;
      segDistance = 0;
      segStartTime = cur.timestamp;
      segElevGainPoints = [cur];
    }
  }

  // trailing partial split
  if (segDistance > 50) {
    const lastPoint = points[points.length - 1];
    const durationS = (lastPoint.timestamp - segStartTime) / 1000;
    splits.push({
      index,
      distanceM: segDistance,
      durationS,
      paceSPerKm: durationS / (segDistance / 1000),
      elevationGainM: elevationGainM(segElevGainPoints),
    });
  }
  return splits;
}

/**
 * Rolling pace over the last `windowS` seconds of the track.
 * This is what the live "current pace" tile shows.
 */
export function rollingPaceSPerKm(points: TrackPoint[], windowS = 30): number | null {
  if (points.length < 2) return null;
  const end = points[points.length - 1].timestamp;
  const cutoff = end - windowS * 1000;
  const windowPoints = points.filter((p) => p.timestamp >= cutoff);
  if (windowPoints.length < 2) return null;
  const d = totalDistanceM(windowPoints);
  const t = (windowPoints[windowPoints.length - 1].timestamp - windowPoints[0].timestamp) / 1000;
  return paceSPerKm(d, t);
}
