import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = `${FileSystem.documentDirectory}offline_maps/`;
const REGIONS_KEY = 'offline_map_regions';

export interface MapRegion {
  id: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeBytes: number;
}

export interface DownloadProgress {
  total: number;
  downloaded: number;
  bytes: number;
}

// Convert lat/lon to tile coordinates
function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

// Calculate bounding tiles
function getTilesForRegion(region: Omit<MapRegion, 'id' | 'name' | 'tileCount' | 'sizeBytes'>) {
  const tiles: { z: number; x: number; y: number }[] = [];
  for (let z = region.minZoom; z <= region.maxZoom; z++) {
    const minX = lon2tile(region.minLon, z);
    const maxX = lon2tile(region.maxLon, z);
    // Note: y increases downwards
    const minY = lat2tile(region.maxLat, z);
    const maxY = lat2tile(region.minLat, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

export async function initCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export async function getDownloadedRegions(): Promise<MapRegion[]> {
  try {
    const data = await AsyncStorage.getItem(REGIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function estimateTileCount(minLat: number, maxLat: number, minLon: number, maxLon: number, minZoom: number, maxZoom: number) {
  const tiles = getTilesForRegion({ minLat, maxLat, minLon, maxLon, minZoom, maxZoom });
  return {
    count: tiles.length,
    estimatedBytes: tiles.length * 15000, // ~15KB per tile
  };
}

export async function downloadRegion(
  name: string,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  minZoom: number,
  maxZoom: number,
  onProgress?: (p: DownloadProgress) => void
): Promise<MapRegion> {
  await initCacheDir();
  
  const tiles = getTilesForRegion({ minLat, maxLat, minLon, maxLon, minZoom, maxZoom });
  let downloaded = 0;
  let totalBytes = 0;

  // Create directories for each z/x pair required
  const dirs = new Set<string>();
  for (const t of tiles) {
    dirs.add(`${CACHE_DIR}${t.z}`);
    dirs.add(`${CACHE_DIR}${t.z}/${t.x}`);
  }

  for (const dir of Array.from(dirs).sort()) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  // Download tiles concurrently (batches of 10)
  const batchSize = 10;
  for (let i = 0; i < tiles.length; i += batchSize) {
    const batch = tiles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (t) => {
      const url = `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
      const localUri = `${CACHE_DIR}${t.z}/${t.x}/${t.y}.png`;
      
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        try {
          const result = await FileSystem.downloadAsync(url, localUri);
          const stat = await FileSystem.getInfoAsync(result.uri);
          if (stat.exists && stat.size) {
            totalBytes += stat.size;
          }
        } catch (e) {
          console.warn(`Failed to download tile ${t.z}/${t.x}/${t.y}`);
        }
      } else if (info.size) {
        totalBytes += info.size;
      }
    }));
    
    downloaded += batch.length;
    if (onProgress) {
      onProgress({ total: tiles.length, downloaded: Math.min(downloaded, tiles.length), bytes: totalBytes });
    }
  }

  const region: MapRegion = {
    id: Date.now().toString(),
    name,
    minLat, maxLat, minLon, maxLon, minZoom, maxZoom,
    tileCount: tiles.length,
    sizeBytes: totalBytes,
  };

  const regions = await getDownloadedRegions();
  regions.push(region);
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(regions));

  return region;
}

export async function deleteRegion(id: string) {
  const regions = await getDownloadedRegions();
  const region = regions.find(r => r.id === id);
  if (!region) return;

  // We simply delete the entire cache dir and re-download logic will skip existing
  // Or we can smartly delete tiles if we had a proper tile reference counting system.
  // For simplicity, if we delete a region, we'll just remove it from the list.
  // The tiles remain, but won't be re-downloaded if overlapping.
  // A "Clear Cache" function can wipe the whole folder.
  const updated = regions.filter(r => r.id !== id);
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(updated));
}

export async function clearAllOfflineMaps() {
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  await AsyncStorage.removeItem(REGIONS_KEY);
}

export function getLocalTileUrlTemplate() {
  // react-native-maps <LocalTile> uses {z}/{x}/{y} formatting
  return `${CACHE_DIR}{z}/{x}/{y}.png`;
}
