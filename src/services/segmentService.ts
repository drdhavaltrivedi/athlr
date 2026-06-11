import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Activity, Segment, SegmentEffort, TrackPoint } from '@/types';

// Haversine distance in meters
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function createSegment(segment: Segment): Promise<void> {
  const ref = doc(db, 'segments', segment.id);
  await setDoc(ref, segment);
}

export async function getSegment(id: string): Promise<Segment | null> {
  const ref = doc(db, 'segments', id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Segment) : null;
}

export async function getSegmentLeaderboard(segmentId: string): Promise<SegmentEffort[]> {
  const q = query(
    collection(db, 'segmentEfforts'),
    where('segmentId', '==', segmentId),
    orderBy('elapsedTimeS', 'asc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as SegmentEffort);
}

/** 
 * Scans an activity for any matches against all known segments.
 * In a real app, we'd spatially query segments using Geohashes.
 * For MVP, we fetch all segments (or a subset) and check.
 */
export async function matchActivityToSegments(activity: Activity): Promise<SegmentEffort[]> {
  if (!activity.points || activity.points.length < 2) return [];

  const segmentsSnap = await getDocs(collection(db, 'segments'));
  const allSegments = segmentsSnap.docs.map(d => d.data() as Segment);
  
  const matchedEfforts: SegmentEffort[] = [];
  
  for (const segment of allSegments) {
    // 1. Find start point match (within 50 meters)
    let startIndex = -1;
    for (let i = 0; i < activity.points.length; i++) {
      const p = activity.points[i];
      const dist = getDistanceMeters(p.latitude, p.longitude, segment.startPoint.lat, segment.startPoint.lon);
      if (dist < 75) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) continue;

    // 2. Find end point match (must happen AFTER start point, within 50 meters)
    let endIndex = -1;
    for (let i = startIndex + 1; i < activity.points.length; i++) {
      const p = activity.points[i];
      const dist = getDistanceMeters(p.latitude, p.longitude, segment.endPoint.lat, segment.endPoint.lon);
      if (dist < 75) {
        endIndex = i;
        break;
      }
    }

    if (endIndex !== -1) {
      // 3. We have a match! Calculate time.
      const startPoint = activity.points[startIndex];
      const endPoint = activity.points[endIndex];
      const elapsedTimeS = (endPoint.timestamp - startPoint.timestamp) / 1000;

      // Basic sanity check: did they cover at least 50% of the segment distance?
      // (To prevent "shortcuts" triggering a false match)
      // For MVP, we'll just trust it if it hits both radii.

      const effortId = `${activity.id}_${segment.id}`;
      const effort: SegmentEffort = {
        id: effortId,
        segmentId: segment.id,
        segmentName: segment.name,
        userId: activity.uid || 'unknown',
        userName: activity.userName || 'Unknown',
        activityId: activity.id,
        elapsedTimeS: Math.round(elapsedTimeS),
        date: activity.startedAt,
      };

      matchedEfforts.push(effort);

      // Save effort to DB
      await setDoc(doc(db, 'segmentEfforts', effortId), effort);
    }
  }

  return matchedEfforts;
}

export async function getEffortsForActivity(activityId: string): Promise<SegmentEffort[]> {
  const q = query(
    collection(db, 'segmentEfforts'),
    where('activityId', '==', activityId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as SegmentEffort);
}
