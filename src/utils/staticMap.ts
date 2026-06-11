import { TrackPoint } from '@/types';

/**
 * Google Static Maps API integration.
 *
 * Set your API key in app.json extra.googleMapsKey (or via EAS Secrets for
 * production). For development, set GOOGLE_MAPS_KEY below.
 *
 * Docs: https://developers.google.com/maps/documentation/maps-static/overview
 */

// ⚠️  Replace with your own key, or set via environment variable / EAS Secret.
// For local dev: create a .env file and pass it in via app.config.js
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

/**
 * Encode a polyline using the Google Encoded Polyline Algorithm.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodePolyline(points: Array<{ latitude: number; longitude: number }>): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const p of points) {
    const lat = Math.round(p.latitude * 1e5);
    const lng = Math.round(p.longitude * 1e5);
    result += encodeValue(lat - prevLat);
    result += encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return result;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  result += String.fromCharCode((v + 63));
  return result;
}

/**
 * Subsample a point array to at most maxPoints (Static Maps path limit).
 * Uses uniform stride — not Ramer-Douglas-Peucker, but good enough for thumbnails.
 */
function subsample(points: TrackPoint[], maxPoints = 100): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result: TrackPoint[] = [];
  for (let i = 0; i < points.length; i += step) result.push(points[i]);
  // Always include the last point
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

export interface StaticMapOptions {
  width?: number;
  height?: number;
  zoom?: number;
  maptype?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
  /** Route line color in hex (no #) */
  lineColor?: string;
  lineWeight?: number;
}

/**
 * Build a Google Static Maps URL for a GPS route.
 * Returns null if no API key is configured or points is empty.
 */
export function buildStaticMapUrl(
  points: TrackPoint[],
  opts: StaticMapOptions = {},
): string | null {
  if (!GOOGLE_MAPS_KEY || points.length < 2) return null;

  const {
    width = 600,
    height = 300,
    maptype = 'roadmap',
    lineColor = 'FFB020',
    lineWeight = 4,
  } = opts;

  const sampled = subsample(points, 100);
  const encoded = encodePolyline(sampled);

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    maptype,
    style: [
      'element:geometry|color:0x0b1220',
      'element:labels.text.fill|color:0x8a97ad',
      'feature:road|element:geometry|color:0x22304a',
      'feature:water|element:geometry|color:0x0b1220',
    ].join('&style='),
    path: `color:0x${lineColor}ff|weight:${lineWeight}|enc:${encoded}`,
    key: GOOGLE_MAPS_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Build a static map URL from just a set of lat/lng pairs (no full TrackPoint needed).
 * Useful for activity cards where we only have the summary.
 */
export function buildStaticMapUrlFromCoords(
  coords: Array<{ latitude: number; longitude: number }>,
  opts: StaticMapOptions = {},
): string | null {
  if (!GOOGLE_MAPS_KEY || coords.length < 2) return null;

  const {
    width = 600,
    height = 300,
    maptype = 'roadmap',
    lineColor = 'FFB020',
    lineWeight = 4,
  } = opts;

  const encoded = encodePolyline(coords.slice(0, 100));

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    maptype,
    path: `color:0x${lineColor}ff|weight:${lineWeight}|enc:${encoded}`,
    key: GOOGLE_MAPS_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Render a simple SVG route thumbnail when no API key is configured.
 * Returns an SVG string representing the route shape normalised to the viewport.
 */
export function buildSvgRoute(
  points: TrackPoint[],
  width = 300,
  height = 150,
): string {
  if (points.length < 2) return '';

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const pad = 12;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const coords = subsample(points, 200).map((p) => {
    const x = pad + ((p.longitude - minLng) / lngRange) * W;
    // SVG y increases downward; lat increases upward → flip
    const y = pad + ((maxLat - p.latitude) / latRange) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#0B1220" rx="12"/>
  <polyline
    points="${coords.join(' ')}"
    fill="none"
    stroke="#FFB020"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;
}
