/** Display formatting. All distances stored in meters, times in seconds. */

export function formatDistanceKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals);
}

export function formatDuration(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/** "5:32" min/km from seconds-per-km. */
export function formatPace(sPerKm: number | null): string {
  if (sPerKm == null || !isFinite(sPerKm) || sPerKm <= 0) return '–:––';
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${pad(s)}`;
}

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

export const SPORT_ICON: Record<string, string> = {
  run: 'walk', // ionicons names
  ride: 'bicycle',
  walk: 'footsteps',
  hike: 'trail-sign',
};

export const SPORT_LABEL: Record<string, string> = {
  run: 'Run',
  ride: 'Ride',
  walk: 'Walk',
  hike: 'Hike',
};
