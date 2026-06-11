/**
 * Core domain types for Athlr.
 */

export type SportType =
  | 'run'
  | 'ride'
  | 'walk'
  | 'hike'
  | 'swim'
  | 'yoga'
  | 'workout'
  | 'hiit'
  | 'cycling'
  | 'tennis'
  | 'other';

export type Units = 'km' | 'mi';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  /** meters above sea level, if available */
  altitude: number | null;
  /** GPS-reported horizontal accuracy in meters */
  accuracy: number | null;
  /** speed in m/s as reported (may be null) */
  speed: number | null;
  /** unix epoch ms */
  timestamp: number;
}

export interface Split {
  /** 1-based split index (km or mile) */
  index: number;
  /** distance of this split in meters (last split may be partial) */
  distanceM: number;
  /** elapsed moving time for this split in seconds */
  durationS: number;
  /** average pace in seconds per km */
  paceSPerKm: number;
  /** elevation gain in this split, meters */
  elevationGainM: number;
}

export type ActivityVisibility = 'private' | 'followers' | 'everyone';

export interface Activity {
  id: string;
  sport: SportType;
  title: string;
  /** unix epoch ms */
  startedAt: number;
  /** unix epoch ms */
  endedAt: number;
  /** total elapsed seconds including pauses */
  elapsedS: number;
  /** moving time in seconds (pauses excluded) */
  movingS: number;
  distanceM: number;
  elevationGainM: number;
  /** average moving pace, seconds per km */
  avgPaceSPerKm: number;
  /** privacy: activities are PRIVATE BY DEFAULT */
  visibility: ActivityVisibility;
  points: TrackPoint[];
  splits: Split[];
  userName?: string;
  uid?: string;
  mapUrl?: string;
  kudosCount?: number;
}

/** Lightweight row used for lists (points not loaded). */
export type ActivitySummary = Omit<Activity, 'points' | 'splits'>;

export interface RecordingSnapshot {
  state: 'idle' | 'recording' | 'paused';
  sport: SportType;
  startedAt: number | null;
  elapsedS: number;
  movingS: number;
  distanceM: number;
  elevationGainM: number;
  currentPaceSPerKm: number | null;
  points: TrackPoint[];
}

export interface DayActivity {
  date: string;   // YYYY-MM-DD
  count: number;
  distanceM: number;
}

export interface WeekStats {
  activeDays: number;
  distanceM: number;
  movingS: number;
  elevationGainM: number;
  activities: number;
}

export interface Segment {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  startPoint: { lat: number; lon: number };
  endPoint: { lat: number; lon: number };
  distanceMeters: number;
  elevationGainMeters: number;
  polyline: string; // encoded coordinates
  createdAt: number;
}

export interface SegmentEffort {
  id: string;
  segmentId: string;
  segmentName: string;
  userId: string;
  userName: string;
  activityId: string;
  elapsedTimeS: number;
  date: number; // unix epoch ms
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'distance' | 'elevation' | 'count';
  sport: SportType | 'all';
  targetValue: number; // e.g. 100000 for 100km
  startDate: number; // unix epoch ms
  endDate: number; // unix epoch ms
  participantCount: number;
}

export interface ChallengeParticipant {
  uid: string;
  displayName: string;
  progressValue: number;
  joinedAt: number;
}

