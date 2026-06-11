import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Activity } from '@/types';

/**
 * GPX export. Your data is yours — every activity can leave the app
 * in a standard format with two taps, no subscription required.
 */

export function activityToGpx(a: Activity): string {
  const trkpts = a.points
    .map((p) => {
      const time = new Date(p.timestamp).toISOString();
      const ele = p.altitude != null ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">${ele}<time>${time}</time></trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Athlr" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(a.title)}</name>
    <time>${new Date(a.startedAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(a.title)}</name>
    <type>${a.sport}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export async function exportAndShareGpx(a: Activity): Promise<void> {
  const gpx = activityToGpx(a);
  const safe = a.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const uri = `${FileSystem.cacheDirectory}${safe}-${a.id}.gpx`;
  await FileSystem.writeAsStringAsync(uri, gpx);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/gpx+xml',
      dialogTitle: 'Export activity (GPX)',
    });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
