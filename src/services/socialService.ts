import { collection, doc, setDoc, deleteDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  isFollowing?: boolean;
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
