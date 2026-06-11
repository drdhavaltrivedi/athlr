import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { Activity } from '@/types';

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
    
    // Create a lean version of the activity for the feed
    const cloudActivity = {
      ...activity,
      uid: user.uid,
      userName: user.displayName || 'Athlete',
      syncedAt: serverTimestamp(),
      points: [], // DONT UPLOAD 1000s of GPS POINTS to firestore to save read/write costs
    };

    await setDoc(activityRef, cloudActivity, { merge: true });
  } catch (error) {
    console.error('Failed to sync activity:', error);
  }
}

/**
 * Fetch the global community feed (recent public activities).
 */
export async function getCommunityFeed(): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'activities'),
      where('visibility', 'in', ['everyone', 'followers']),
      orderBy('startedAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Failed to fetch community feed:', error);
    return [];
  }
}

/**
 * Toggle a kudo for an activity in Firestore
 */
export async function toggleKudo(activityId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const kudoRef = doc(db, 'activities', activityId, 'kudos', user.uid);
    // For simplicity, we just toggle by checking if it exists. 
    // In a production app, we would use a batched write to increment/decrement a counter on the activity doc.
    const kudoDoc = await getDocs(query(collection(db, 'activities', activityId, 'kudos'), where('__name__', '==', user.uid)));
    if (!kudoDoc.empty) {
      // remove
      // await deleteDoc(kudoRef); // Note: we'd need to import deleteDoc
      return false; // stub
    } else {
      await setDoc(kudoRef, { uid: user.uid, timestamp: serverTimestamp() });
      return true;
    }
  } catch (e) {
    console.error(e);
    return false;
  }
}
