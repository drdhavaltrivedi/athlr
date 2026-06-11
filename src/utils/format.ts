/** Display formatting. All distances stored in meters, times in seconds. */

import { Units } from '@/types';

// ─── Distance ────────────────────────────────────────────────────────────────

export function formatDistance(meters: number, units: Units, decimals = 2): string {
  if (units === 'mi') {
    return (meters / 1609.344).toFixed(decimals);
  }
  return (meters / 1000).toFixed(decimals);
}

export function distanceUnit(units: Units): string {
  return units === 'mi' ? 'mi' : 'km';
}

/** Legacy km-only helper kept for backward compat */
export function formatDistanceKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals);
}

// ─── Duration ────────────────────────────────────────────────────────────────

export function formatDuration(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

// ─── Pace ────────────────────────────────────────────────────────────────────

/** Format pace for display. sPerKm is always stored in s/km; convert for miles. */
export function formatPace(sPerKm: number | null, units: Units = 'km'): string {
  if (sPerKm == null || !isFinite(sPerKm) || sPerKm <= 0) return '–:––';
  const sPerUnit = units === 'mi' ? sPerKm * 1.60934 : sPerKm;
  const m = Math.floor(sPerUnit / 60);
  const s = Math.round(sPerUnit % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${pad(s)}`;
}

export function paceUnit(units: Units): string {
  return units === 'mi' ? '/mi' : '/km';
}

// ─── Date / Time ─────────────────────────────────────────────────────────────

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// ─── Sport metadata ───────────────────────────────────────────────────────────

export const SPORT_ICON: Record<string, string> = {
  run:      'body',
  ride:     'bicycle',
  walk:     'footsteps',
  hike:     'trail-sign',
  swim:     'water',
  yoga:     'leaf',
  workout:  'barbell',
  hiit:     'flame',
  cycling:  'bicycle-outline',
  tennis:   'tennisball',
  other:    'ellipsis-horizontal-circle',
};

export const SPORT_LABEL: Record<string, string> = {
  run:      'Run',
  ride:     'Ride',
  walk:     'Walk',
  hike:     'Hike',
  swim:     'Swim',
  yoga:     'Yoga',
  workout:  'Workout',
  hiit:     'HIIT',
  cycling:  'Cycling',
  tennis:   'Tennis',
  other:    'Other',
};

/** Accent colour per sport — used for card borders & icons */
export const SPORT_COLOR: Record<string, string> = {
  run:      '#FFB020',
  ride:     '#3DDC84',
  walk:     '#4FC3F7',
  hike:     '#A5D6A7',
  swim:     '#29B6F6',
  yoga:     '#CE93D8',
  workout:  '#FF8A65',
  hiit:     '#FF5A5F',
  cycling:  '#66BB6A',
  tennis:   '#FFF176',
  other:    '#8A97AD',
};
