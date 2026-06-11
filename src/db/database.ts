import * as SQLite from 'expo-sqlite';
import { Activity, ActivitySummary, DayActivity, WeekStats } from '@/types';

/**
 * Offline-first storage. Every activity lives on-device in SQLite;
 * cloud sync reads from here and marks rows synced.
 * The app must never lose a workout because of a network problem.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('athlr.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          sport TEXT NOT NULL,
          title TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER NOT NULL,
          elapsed_s INTEGER NOT NULL,
          moving_s INTEGER NOT NULL,
          distance_m INTEGER NOT NULL,
          elevation_gain_m INTEGER NOT NULL,
          avg_pace_s_per_km INTEGER NOT NULL,
          visibility TEXT NOT NULL DEFAULT 'private',
          points_json TEXT NOT NULL,
          splits_json TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'manual',
          source_id TEXT,
          avg_heart_rate INTEGER,
          calories INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_activities_started
          ON activities(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activities_source_id
          ON activities(source_id);
      `);

      // Migration: add new columns to existing DBs that don't have them
      const cols = await db.getAllAsync<{name: string}>(`PRAGMA table_info(activities)`);
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('source')) {
        await db.execAsync(`ALTER TABLE activities ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
      }
      if (!colNames.includes('source_id')) {
        await db.execAsync(`ALTER TABLE activities ADD COLUMN source_id TEXT`);
      }
      if (!colNames.includes('avg_heart_rate')) {
        await db.execAsync(`ALTER TABLE activities ADD COLUMN avg_heart_rate INTEGER`);
      }
      if (!colNames.includes('calories')) {
        await db.execAsync(`ALTER TABLE activities ADD COLUMN calories INTEGER`);
      }
      return db;
    });
  }
  return dbPromise;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveActivity(
  a: Activity,
  extra?: { source?: string; sourceId?: string; avgHeartRate?: number | null; calories?: number | null },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
     (id, sport, title, started_at, ended_at, elapsed_s, moving_s,
      distance_m, elevation_gain_m, avg_pace_s_per_km, visibility,
      points_json, splits_json, synced, source, source_id, avg_heart_rate, calories)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    a.id, a.sport, a.title, a.startedAt, a.endedAt, a.elapsedS,
    a.movingS, a.distanceM, a.elevationGainM, a.avgPaceSPerKm,
    a.visibility, JSON.stringify(a.points), JSON.stringify(a.splits),
    extra?.source ?? 'manual',
    extra?.sourceId ?? null,
    extra?.avgHeartRate ?? null,
    extra?.calories ?? null,
  );
  
  // Sync to cloud if visibility is not private
  if (a.visibility !== 'private') {
    import('@/services/cloudSyncService').then(m => m.syncActivityToCloud(a)).catch(console.error);
  }
}

/** Returns true if a workout with the given sourceId is already in the DB. */
export async function isAlreadyImported(sourceId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM activities WHERE source_id = ? LIMIT 1`, sourceId,
  );
  return row != null;
}

export async function updateTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE activities SET title = ? WHERE id = ?`, title, id);
}

export async function updateVisibility(
  id: string,
  visibility: 'private' | 'followers' | 'everyone',
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE activities SET visibility = ?, synced = 0 WHERE id = ?`,
    visibility,
    id,
  );
  
  // Retrieve the full activity to sync it
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM activities WHERE id = ?`, id
  );
  if (row) {
    const a: Activity = {
      id: row.id,
      sport: row.sport as any,
      title: row.title,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      elapsedS: row.elapsed_s,
      movingS: row.moving_s,
      distanceM: row.distance_m,
      elevationGainM: row.elevation_gain_m,
      avgPaceSPerKm: row.avg_pace_s_per_km,
      visibility: row.visibility as any,
      points: JSON.parse(row.points_json),
      splits: JSON.parse(row.splits_json),
    };
    import('@/services/cloudSyncService').then(m => m.syncActivityToCloud(a)).catch(console.error);
  }
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM activities WHERE id = ?`, id);
}

export async function getPendingSyncActivities(): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM activities WHERE synced = 0 AND visibility != 'private'`,
  );
  return rows.map((row) => ({
    ...rowToSummary(row),
    points: JSON.parse(row.points_json as string),
    splits: JSON.parse(row.splits_json as string),
  }));
}

export async function markActivitySynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE activities SET synced = 1 WHERE id = ?`, id);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listActivities(
  limit = 100,
  sport?: string,
): Promise<ActivitySummary[]> {
  const db = await getDb();
  const rows = sport && sport !== 'all'
    ? await db.getAllAsync<Record<string, unknown>>(
        `SELECT id, sport, title, started_at, ended_at, elapsed_s, moving_s,
                distance_m, elevation_gain_m, avg_pace_s_per_km, visibility
         FROM activities WHERE sport = ? ORDER BY started_at DESC LIMIT ?`,
        sport, limit,
      )
    : await db.getAllAsync<Record<string, unknown>>(
        `SELECT id, sport, title, started_at, ended_at, elapsed_s, moving_s,
                distance_m, elevation_gain_m, avg_pace_s_per_km, visibility
         FROM activities ORDER BY started_at DESC LIMIT ?`,
        limit,
      );
  return rows.map(rowToSummary);
}

export async function getActivity(id: string): Promise<Activity | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM activities WHERE id = ?`, id,
  );
  if (!row) return null;
  return {
    ...rowToSummary(row),
    points: JSON.parse(row.points_json as string),
    splits: JSON.parse(row.splits_json as string),
  };
}

// ─── Aggregate stats ──────────────────────────────────────────────────────────

export interface LifetimeStats {
  count: number;
  distanceM: number;
  movingS: number;
  elevationGainM: number;
}

export async function lifetimeStats(): Promise<LifetimeStats> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, number>>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(distance_m), 0) AS distanceM,
            COALESCE(SUM(moving_s), 0) AS movingS,
            COALESCE(SUM(elevation_gain_m), 0) AS elevationGainM
     FROM activities`,
  );
  return (row as LifetimeStats | null) ?? { count: 0, distanceM: 0, movingS: 0, elevationGainM: 0 };
}

export async function weekStats(): Promise<WeekStats> {
  const db = await getDb();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const startMs = monday.getTime();

  const row = await db.getFirstAsync<Record<string, number>>(
    `SELECT COUNT(*) AS activities,
            COUNT(DISTINCT date(started_at/1000, 'unixepoch')) AS activeDays,
            COALESCE(SUM(distance_m), 0) AS distanceM,
            COALESCE(SUM(moving_s), 0) AS movingS,
            COALESCE(SUM(elevation_gain_m), 0) AS elevationGainM
     FROM activities WHERE started_at >= ?`,
    startMs,
  );
  return (row as WeekStats | null) ?? { activities: 0, activeDays: 0, distanceM: 0, movingS: 0, elevationGainM: 0 };
}

export async function monthStats(): Promise<WeekStats> {
  const db = await getDb();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const row = await db.getFirstAsync<Record<string, number>>(
    `SELECT COUNT(*) AS activities,
            COUNT(DISTINCT date(started_at/1000, 'unixepoch')) AS activeDays,
            COALESCE(SUM(distance_m), 0) AS distanceM,
            COALESCE(SUM(moving_s), 0) AS movingS,
            COALESCE(SUM(elevation_gain_m), 0) AS elevationGainM
     FROM activities WHERE started_at >= ?`,
    startOfMonth,
  );
  return (row as WeekStats | null) ?? { activities: 0, activeDays: 0, distanceM: 0, movingS: 0, elevationGainM: 0 };
}

/** Per-day activity data for the calendar heatmap (last 90 days). */
export async function calendarData(days = 90): Promise<DayActivity[]> {
  const db = await getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT date(started_at/1000, 'unixepoch') AS date,
            COUNT(*) AS count,
            COALESCE(SUM(distance_m), 0) AS distanceM
     FROM activities
     WHERE started_at >= ?
     GROUP BY date
     ORDER BY date ASC`,
    since,
  );
  return rows.map((r) => ({
    date: r.date as string,
    count: r.count as number,
    distanceM: r.distanceM as number,
  }));
}

/** Activities for a specific ISO date string (YYYY-MM-DD). */
export async function activitiesForDay(date: string): Promise<ActivitySummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT id, sport, title, started_at, ended_at, elapsed_s, moving_s,
            distance_m, elevation_gain_m, avg_pace_s_per_km, visibility
     FROM activities
     WHERE date(started_at/1000, 'unixepoch') = ?
     ORDER BY started_at DESC`,
    date,
  );
  return rows.map(rowToSummary);
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToSummary(row: Record<string, unknown>): ActivitySummary {
  return {
    id: row.id as string,
    sport: row.sport as ActivitySummary['sport'],
    title: row.title as string,
    startedAt: row.started_at as number,
    endedAt: row.ended_at as number,
    elapsedS: row.elapsed_s as number,
    movingS: row.moving_s as number,
    distanceM: row.distance_m as number,
    elevationGainM: row.elevation_gain_m as number,
    avgPaceSPerKm: row.avg_pace_s_per_km as number,
    visibility: row.visibility as ActivitySummary['visibility'],
  };
}
