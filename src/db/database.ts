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
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_activities_started
          ON activities(started_at DESC);
      `);
      return db;
    });
  }
  return dbPromise;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveActivity(a: Activity): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
     (id, sport, title, started_at, ended_at, elapsed_s, moving_s,
      distance_m, elevation_gain_m, avg_pace_s_per_km, visibility,
      points_json, splits_json, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    a.id, a.sport, a.title, a.startedAt, a.endedAt, a.elapsedS,
    a.movingS, a.distanceM, a.elevationGainM, a.avgPaceSPerKm,
    a.visibility, JSON.stringify(a.points), JSON.stringify(a.splits),
  );
}

export async function updateTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE activities SET title = ? WHERE id = ?`, title, id);
}

export async function updateVisibility(id: string, visibility: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE activities SET visibility = ? WHERE id = ?`, visibility, id);
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM activities WHERE id = ?`, id);
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
