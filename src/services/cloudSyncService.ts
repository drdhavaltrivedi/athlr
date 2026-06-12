import { collection, doc, setDoc, deleteDoc, getDoc, serverTimestamp, query, where, getDocs, limit, orderBy, increment, startAfter } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { Activity } from '@/types';
import polyline from '@mapbox/polyline';
import { getPendingSyncActivities, markActivitySynced } from '@/db/database';
import { updateChallengeProgressForActivity } from '@/services/challengeService';

/**
 * Uploads an activity to Firestore so it appears in the global feed.
 * Strips the heavy `points` array (GPS polyline) to save bandwidth/storage,
 * but keeps `splits` and summary stats. We could use `staticMap` to generate
 * an encoded polyline string to save in Firestore if we wanted a thumbnail.
 */
export async function syncActivityToCloud(activity: Activity): Promise<void> {
  const user = auth.currentUser;
  if (!user) return; // not logged in

  if (activity.visibility === 'private') {
    // We don't upload private activities to the community feed
    return;
  }

  try {
    const activityRef = doc(db, 'activities', activity.id);
    
    // Generate encoded polyline and Static Map URL if we have points
    let mapUrl = '';
    if (activity.points && activity.points.length > 2) {
      // Downsample points to avoid URL length limits for very long routes
      const step = Math.ceil(activity.points.length / 200);
      const coords = activity.points.filter((_, i) => i % step === 0).map(p => [p.latitude, p.longitude] as [number, number]);
      const enc = polyline.encode(coords);
      // Use the Firebase API Key as the Google Maps Key. (Note: Ensure Static Maps API is enabled in GCP)
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY; 
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=800x400&path=weight:4%7Ccolor:0xfe5c36ff%7Cenc:${enc}&key=${apiKey}`;
    }
    
    // Create a lean version of the activity for the feed.
    // NOTE: kudosCount is intentionally NOT set here — re-syncing must never
    // reset accumulated kudos. toggleKudo() owns that field via increment().
    const { kudosCount: _ignored, ...activityWithoutKudos } = activity;
    const cloudActivity = {
      ...activityWithoutKudos,
      uid: user.uid,
      userName: user.displayName || 'Athlete',
      syncedAt: serverTimestamp(),
      mapUrl,
      points: [], // DONT UPLOAD 1000s of GPS POINTS to firestore to save read/write costs
    };

    await setDoc(activityRef, cloudActivity, { merge: true });
    
    // Auto-update any active challenges
    await updateChallengeProgressForActivity(activity);

    // Mark as synced locally
    await markActivitySynced(activity.id);
  } catch (error) {
    console.warn('Failed to sync activity:', error);
  }
}

/**
 * Background sync function. Queries SQLite for activities that haven't
 * been synced to the cloud yet (synced = 0) and uploads them.
 */
export async function syncPendingActivities(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return; // Wait until logged in

  try {
    const pending = await getPendingSyncActivities();
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} pending activities...`);
    
    // Upload sequentially to avoid overloading network/Firebase limits
    for (const activity of pending) {
      await syncActivityToCloud(activity);
    }
    
    console.log('Background sync complete.');
  } catch (error) {
    console.warn('Error during background sync:', error);
  }
}

export const FEED_PAGE_SIZE = 20;

/**
 * Fetch the community feed: public activities from everyone, merged with
 * followers-only activities from people you follow — so following one
 * friend never empties the feed.
 *
 * Pass `beforeStartedAt` (the startedAt of the last item you have) to load
 * the next page.
 */
export async function getCommunityFeed(beforeStartedAt?: number): Promise<any[]> {
  try {
    const { getFollowingIds } = await import('./socialService');
    const followingIds = await getFollowingIds();
    // Firestore 'in' supports max 10 values; beyond that needs fan-out.
    const uidsToQuery = followingIds.slice(0, 10);

    const cursor = beforeStartedAt != null ? [startAfter(beforeStartedAt)] : [];

    const queries = [
      query(
        collection(db, 'activities'),
        where('visibility', '==', 'everyone'),
        orderBy('startedAt', 'desc'),
        ...cursor,
        limit(FEED_PAGE_SIZE),
      ),
    ];
    if (uidsToQuery.length > 0) {
      queries.push(
        query(
          collection(db, 'activities'),
          where('uid', 'in', uidsToQuery),
          where('visibility', 'in', ['everyone', 'followers']),
          orderBy('startedAt', 'desc'),
          ...cursor,
          limit(FEED_PAGE_SIZE),
        ),
      );
    }

    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    const byId = new Map<string, any>();
    for (const snap of snapshots) {
      for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() });
    }
    const items = [...byId.values()]
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      .slice(0, FEED_PAGE_SIZE);

    // Mark which activities the current user has already kudoed so the
    // heart renders filled on first paint.
    const user = auth.currentUser;
    if (user && items.length > 0) {
      await Promise.all(
        items.map(async (a) => {
          const k = await getDoc(doc(db, 'activities', a.id, 'kudos', user.uid)).catch(() => null);
          a.givenByMe = k?.exists() ?? false;
        }),
      );
    }
    return items;
  } catch (error) {
    console.warn('Failed to fetch community feed:', error);
    return [];
  }
}

export type KudoResult = 'added' | 'removed' | 'error';

/**
 * Toggle a kudo for an activity. Maintains the denormalized kudosCount on
 * the activity doc so feeds can show counts without reading the subcollection.
 */
export async function toggleKudo(activityId: string): Promise<KudoResult> {
  const user = auth.currentUser;
  if (!user) return 'error';

  try {
    const kudoRef = doc(db, 'activities', activityId, 'kudos', user.uid);
    const activityRef = doc(db, 'activities', activityId);

    const existing = await getDoc(kudoRef);
    if (existing.exists()) {
      await deleteDoc(kudoRef);
      await setDoc(activityRef, { kudosCount: increment(-1) }, { merge: true });
      return 'removed';
    }
    await setDoc(kudoRef, { uid: user.uid, timestamp: serverTimestamp() });
    await setDoc(activityRef, { kudosCount: increment(1) }, { merge: true });
    return 'added';
  } catch (e) {
    console.warn('Kudo toggle failed:', e);
    return 'error';
  }
}
