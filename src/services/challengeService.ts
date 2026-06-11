import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, increment } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { Challenge, ChallengeParticipant, Activity } from '@/types';

export async function seedSampleChallenges() {
  const challengesRef = collection(db, 'challenges');
  const snapshot = await getDocs(challengesRef);
  if (!snapshot.empty) return; // already seeded

  const now = Date.now();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).getTime();

  const sampleChallenges: Challenge[] = [
    {
      id: 'june-100k-run',
      title: 'Monthly 100km Run',
      description: 'Push yourself this month! Run 100km total before the month ends to complete the challenge.',
      type: 'distance',
      sport: 'running',
      targetValue: 100000,
      startDate: startOfMonth,
      endDate: endOfMonth,
      participantCount: 0,
    },
    {
      id: 'summer-elevation',
      title: 'Summer Elevation Challenge',
      description: 'Climb a total of 5,000 meters this month across any sport.',
      type: 'elevation',
      sport: 'all',
      targetValue: 5000,
      startDate: startOfMonth,
      endDate: endOfMonth,
      participantCount: 0,
    },
    {
      id: 'cycling-century',
      title: 'Century Ride Month',
      description: 'Ride 500km this month on your bike.',
      type: 'distance',
      sport: 'cycling',
      targetValue: 500000,
      startDate: startOfMonth,
      endDate: endOfMonth,
      participantCount: 0,
    }
  ];

  for (const c of sampleChallenges) {
    await setDoc(doc(db, 'challenges', c.id), c);
  }
}

export async function getActiveChallenges(): Promise<Challenge[]> {
  try {
    const q = query(collection(db, 'challenges'), orderBy('endDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Challenge);
  } catch (err) {
    console.error('Failed to get challenges:', err);
    return [];
  }
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  try {
    const docSnap = await getDoc(doc(db, 'challenges', id));
    return docSnap.exists() ? (docSnap.data() as Challenge) : null;
  } catch (err) {
    console.error('Failed to get challenge:', err);
    return null;
  }
}

export async function getChallengeLeaderboard(challengeId: string): Promise<ChallengeParticipant[]> {
  try {
    const q = query(
      collection(db, `challenges/${challengeId}/participants`),
      orderBy('progressValue', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ChallengeParticipant);
  } catch (err) {
    console.error('Failed to get leaderboard:', err);
    return [];
  }
}

export async function getMyParticipantInfo(challengeId: string): Promise<ChallengeParticipant | null> {
  if (!auth.currentUser) return null;
  try {
    const docSnap = await getDoc(doc(db, `challenges/${challengeId}/participants`, auth.currentUser.uid));
    return docSnap.exists() ? (docSnap.data() as ChallengeParticipant) : null;
  } catch (err) {
    return null;
  }
}

export async function joinChallenge(challenge: Challenge): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    // 1. Calculate retroactive progress
    let progressValue = 0;
    
    // Fetch user's activities in the date range
    const actsQ = query(
      collection(db, 'activities'),
      where('uid', '==', user.uid),
      where('startedAt', '>=', challenge.startDate),
      where('startedAt', '<=', challenge.endDate)
    );
    
    const snapshot = await getDocs(actsQ);
    snapshot.forEach(docSnap => {
      const act = docSnap.data() as Activity;
      if (challenge.sport === 'all' || challenge.sport === act.sport) {
        if (challenge.type === 'distance') progressValue += (act.distanceM || 0);
        else if (challenge.type === 'elevation') progressValue += (act.elevationGainM || 0);
        else if (challenge.type === 'count') progressValue += 1;
      }
    });

    // 2. Create participant doc
    const participant: ChallengeParticipant = {
      uid: user.uid,
      displayName: user.displayName || 'Unknown Athlete',
      progressValue,
      joinedAt: Date.now(),
    };

    await setDoc(doc(db, `challenges/${challenge.id}/participants`, user.uid), participant);
    
    // 3. Increment participant count on challenge doc
    await setDoc(doc(db, 'challenges', challenge.id), { participantCount: increment(1) }, { merge: true });

    return true;
  } catch (err) {
    console.error('Failed to join challenge:', err);
    return false;
  }
}

export async function updateChallengeProgressForActivity(activity: Activity): Promise<void> {
  const user = auth.currentUser;
  if (!user || activity.visibility === 'private') return;

  try {
    // Get all active challenges the user is in
    const activeChalsRef = collection(db, 'challenges');
    const chalsSnap = await getDocs(activeChalsRef);
    
    const incrementBatch: { chalId: string, val: number }[] = [];

    for (const chalDoc of chalsSnap.docs) {
      const chal = chalDoc.data() as Challenge;
      
      // Check if activity is in date range and matches sport
      if (activity.startedAt >= chal.startDate && activity.startedAt <= chal.endDate) {
        if (chal.sport === 'all' || chal.sport === activity.sport) {
          
          // Check if user is a participant
          const participantRef = doc(db, `challenges/${chal.id}/participants`, user.uid);
          const pSnap = await getDoc(participantRef);
          
          if (pSnap.exists()) {
            let val = 0;
            if (chal.type === 'distance') val = activity.distanceM || 0;
            else if (chal.type === 'elevation') val = activity.elevationGainM || 0;
            else if (chal.type === 'count') val = 1;
            
            if (val > 0) {
              await setDoc(participantRef, { progressValue: increment(val) }, { merge: true });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to auto-update challenge progress:', err);
  }
}
