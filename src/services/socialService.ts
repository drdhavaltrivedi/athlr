import { collection, doc, setDoc, deleteDoc, getDocs, query, where, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string | null;
  username?: string;
  bio?: string;
  isFollowing?: boolean;
}

/** true = available, false = taken, null = network error (couldn't verify). */
export async function checkUsernameUnique(username: string, currentUid: string): Promise<boolean | null> {
  try {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return true;

    // If it's taken but it's our own document, it's fine
    let isOurs = true;
    snapshot.forEach(d => {
      if (d.id !== currentUid) isOurs = false;
    });
    return isOurs;
  } catch (err) {
    console.warn('Failed to check username:', err);
    return null;
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<boolean> {
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to update profile:', err);
    return false;
  }
}

export async function searchUsers(searchQuery: string): Promise<UserProfile[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || !searchQuery.trim()) return [];

  try {
    // In a real app with many users, we'd use Algolia or a specialized search service.
    // Here we'll do a basic prefix search on displayName if we had a users collection.
    // For now, let's just fetch some users (or all users if small) and filter in memory.
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    
    // Get list of users the current user is already following
    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const followingSnapshot = await getDocs(followingRef);
    const followingIds = new Set(followingSnapshot.docs.map(d => d.id));

    const users: UserProfile[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Simple case-insensitive search
      if (
        doc.id !== currentUser.uid &&
        data.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        users.push({
          uid: doc.id,
          displayName: data.displayName,
          email: data.email,
          photoURL: data.photoURL,
          username: data.username,
          bio: data.bio,
          isFollowing: followingIds.has(doc.id),
        });
      }
    });
    
    return users;
  } catch (err) {
    console.error('Failed to search users:', err);
    return [];
  }
}

export async function followUser(targetUid: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  try {
    const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUid);
    const followerRef = doc(db, 'users', targetUid, 'followers', currentUser.uid);

    await setDoc(followingRef, { timestamp: new Date() });
    await setDoc(followerRef, { timestamp: new Date() });
    
    return true;
  } catch (err) {
    console.error('Failed to follow user:', err);
    return false;
  }
}

export async function unfollowUser(targetUid: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  try {
    const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUid);
    const followerRef = doc(db, 'users', targetUid, 'followers', currentUser.uid);

    await deleteDoc(followingRef);
    await deleteDoc(followerRef);
    
    return true;
  } catch (err) {
    console.error('Failed to unfollow user:', err);
    return false;
  }
}

export async function getFollowingIds(): Promise<string[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  try {
    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const snapshot = await getDocs(followingRef);
    return snapshot.docs.map(doc => doc.id);
  } catch (err) {
    console.error('Failed to get following IDs:', err);
    return [];
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const me = auth.currentUser;
    // No follow check needed for your own profile; otherwise fetch in parallel
    const needsFollowCheck = !!me && me.uid !== uid;
    const [userDoc, followingDoc] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      needsFollowCheck
        ? getDoc(doc(db, 'users', me!.uid, 'following', uid))
        : Promise.resolve(null),
    ]);
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    const isFollowing = followingDoc?.exists() ?? false;

    return {
      uid: userDoc.id,
      displayName: data.displayName || 'Unknown Athlete',
      email: data.email,
      photoURL: data.photoURL,
      username: data.username,
      bio: data.bio,
      isFollowing,
    };
  } catch (err) {
    console.warn('Failed to get user profile:', err);
    return null;
  }
}

export async function getUserActivities(uid: string, maxCount: number = 20): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'activities'),
      where('uid', '==', uid),
      where('visibility', '!=', 'private'),
      orderBy('visibility'), // required by firestore when combining where(!=) and orderBy
      orderBy('startedAt', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to get user activities:', err);
    return [];
  }
}
