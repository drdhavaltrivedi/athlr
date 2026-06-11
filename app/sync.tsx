/**
 * Health Sync screen — lets the user connect Apple Health / Google Health Connect
 * and import workouts recorded by any device (Apple Watch, Garmin, Wear OS, etc.)
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  initialize,
  requestPermissions,
  importWorkouts,
  toActivity,
  getStatus,
  ImportedWorkout,
  HealthServiceStatus,
} from '@/services/healthService';
import { saveActivity, isAlreadyImported } from '@/db/database';
import { colors, radii, spacing, type } from '@/theme';
import {
  formatDistance,
  formatDuration,
  SPORT_ICON,
  SPORT_COLOR,
  SPORT_LABEL,
  distanceUnit,
} from '@/utils/format';
import { useRecordingStore } from '@/store/recordingStore';

type SyncState = 'idle' | 'connecting' | 'fetching' | 'importing' | 'done' | 'error';

interface WorkoutRow extends ImportedWorkout {
  alreadyImported: boolean;
  selected: boolean;
}

const SYNC_DAYS = 90; // look back 90 days

export default function SyncScreen() {
  const units = useRecordingStore((s) => s.units);
  const [status, setStatus] = useState<HealthServiceStatus | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [importCount, setImportCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    initialize().then(setStatus);
  }, []);

  const platformName =
    Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect';

  const platformIcon: any =
    Platform.OS === 'ios' ? 'heart-circle' : 'pulse';

  const platformColor = Platform.OS === 'ios' ? '#FF2D55' : '#4285F4';

  // ─── Connect & fetch ─────────────────────────────────────────────────────────

  const onConnect = async () => {
    setSyncState('connecting');
    // On the first ever call iOS presents the Health permission sheet
    // directly in-app. On later calls it resolves silently — iOS never
    // re-shows the sheet, so denied access must be fixed in the Health app.
    const granted = await requestPermissions();
    const updated = getStatus();
    setStatus(updated);
    if (!granted) {
      setSyncState('error');
      if (!updated.available) {
        setErrorMsg(
          updated.reason ??
            'The Health module is not part of this build. Rebuild the app to enable health sync.',
        );
      } else {
        setErrorMsg(
          Platform.OS === 'ios'
            ? 'Athlr needs Health access. Tap "Open Health" below, go to Sharing → Apps → Athlr, and turn everything on.'
            : updated.reason ?? 'Health Connect permission was not granted. Tap "Open Settings" to grant access.',
        );
      }
      return;
    }
    fetchWorkouts();
  };

  const openHealthSettings = () => {
    if (Platform.OS === 'ios') {
      // Opens the Health app (Sharing → Apps → Athlr toggles live there)
      Linking.openURL('x-apple-health://').catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  };

  const fetchWorkouts = async () => {
    setSyncState('fetching');
    try {
      const since = new Date();
      since.setDate(since.getDate() - SYNC_DAYS);
      const raw = await importWorkouts(since);

      // Check which are already in the DB
      const rows: WorkoutRow[] = await Promise.all(
        raw.map(async (w) => ({
          ...w,
          alreadyImported: await isAlreadyImported(w.sourceId),
          selected: false,
        })),
      );

      // Sort newest first, flag already-imported
      rows.sort((a, b) => b.startedAt - a.startedAt);
      setWorkouts(rows);
      setSyncState('idle');
    } catch (e: any) {
      setSyncState('error');
      setErrorMsg(e?.message ?? 'Failed to fetch workouts');
    }
  };

  // ─── Select / import ─────────────────────────────────────────────────────────

  const toggleSelect = (sourceId: string) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.sourceId === sourceId ? { ...w, selected: !w.selected } : w,
      ),
    );
  };

  const selectAll = () => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.alreadyImported ? w : { ...w, selected: true },
      ),
    );
  };

  const deselectAll = () => {
    setWorkouts((prev) => prev.map((w) => ({ ...w, selected: false })));
  };

  const selectedCount = workouts.filter((w) => w.selected).length;

  const onImport = async () => {
    const toImport = workouts.filter((w) => w.selected && !w.alreadyImported);
    if (toImport.length === 0) return;

    setSyncState('importing');
    let count = 0;
    for (const w of toImport) {
      try {
        const activity = toActivity(w);
        await saveActivity(activity, {
          source: w.source,
          sourceId: w.sourceId,
          avgHeartRate: w.avgHeartRate,
          calories: w.calories,
        });
        count++;
      } catch {
        // skip individual failures
      }
    }
    setImportCount(count);
    // Refresh the list — imported items now flagged
    setSyncState('done');
    fetchWorkouts();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const newWorkouts = workouts.filter((w) => !w.alreadyImported);
  const alreadySynced = workouts.filter((w) => w.alreadyImported);

  return (
    <View style={styles.container}>
      {/* Header card */}
      <View style={[styles.card, styles.headerCard]}>
        <View style={[styles.platformIcon, { backgroundColor: platformColor + '22' }]}>
          <Ionicons name={platformIcon} size={28} color={platformColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{platformName}</Text>
          <Text style={type.caption}>
            {status?.authorized
              ? `Connected · ${SYNC_DAYS}-day lookback`
              : 'Tap to connect and import your workouts'}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: status?.authorized ? colors.live : colors.textDim }]} />
      </View>

      {/* How it works */}
      {!status?.authorized && (
        <View style={styles.card}>
          <Text style={type.label}>How it works</Text>
          {HOW_IT_WORKS.map((item) => (
            <View key={item.icon} style={styles.howRow}>
              <View style={styles.howIconWrap}>
                <Ionicons name={item.icon as any} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{item.title}</Text>
                <Text style={type.caption}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Done banner */}
      {syncState === 'done' && importCount > 0 && (
        <View style={styles.doneBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.live} />
          <Text style={[type.body, { color: colors.live }]}>
            {importCount} workout{importCount > 1 ? 's' : ''} imported!
          </Text>
        </View>
      )}

      {/* Error */}
      {syncState === 'error' && (
        <View style={styles.errorBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[type.caption, { color: colors.danger, flex: 1 }]}>{errorMsg}</Text>
          </View>
          {status?.available && (
            <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s }}>
              <Pressable style={styles.errorAction} onPress={openHealthSettings}>
                <Ionicons name={Platform.OS === 'ios' ? 'heart' : 'settings'} size={14} color={colors.text} />
                <Text style={styles.errorActionText}>
                  {Platform.OS === 'ios' ? 'Open Health' : 'Open Settings'}
                </Text>
              </Pressable>
              <Pressable style={styles.errorAction} onPress={onConnect}>
                <Ionicons name="refresh" size={14} color={colors.text} />
                <Text style={styles.errorActionText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Loading */}
      {(syncState === 'fetching' || syncState === 'importing') && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={type.caption}>
            {syncState === 'fetching' ? 'Reading from health store…' : 'Importing workouts…'}
          </Text>
        </View>
      )}

      {/* Workout list */}
      {workouts.length > 0 && (
        <>
          {/* Toolbar */}
          <View style={styles.toolbar}>
            <Text style={type.label}>
              {newWorkouts.length} new · {alreadySynced.length} already synced
            </Text>
            <View style={styles.toolbarActions}>
              <Pressable onPress={selectAll}>
                <Text style={styles.toolbarBtn}>All</Text>
              </Pressable>
              <Pressable onPress={deselectAll}>
                <Text style={styles.toolbarBtn}>None</Text>
              </Pressable>
            </View>
          </View>

          <FlatList
            data={workouts}
            keyExtractor={(w) => w.sourceId}
            contentContainerStyle={{ paddingHorizontal: spacing.m, paddingBottom: 120, gap: spacing.s }}
            renderItem={({ item }) => (
              <WorkoutItem
                item={item}
                units={units}
                onToggle={() => !item.alreadyImported && toggleSelect(item.sourceId)}
              />
            )}
          />
        </>
      )}

      {/* Connect / Import CTA */}
      <View style={styles.ctaWrap}>
        {!status?.authorized ? (
          <Pressable
            style={[styles.cta, { backgroundColor: platformColor }]}
            onPress={onConnect}
            disabled={syncState === 'connecting'}
          >
            {syncState === 'connecting' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Connect {platformName}</Text>
            )}
          </Pressable>
        ) : selectedCount > 0 ? (
          <Pressable
            style={[styles.cta, { backgroundColor: colors.accent }]}
            onPress={onImport}
            disabled={syncState === 'importing'}
          >
            <Text style={styles.ctaText}>Import {selectedCount} Workout{selectedCount > 1 ? 's' : ''}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.cta, { backgroundColor: colors.surfaceAlt }]}
            onPress={fetchWorkouts}
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={[styles.ctaText, { color: colors.text }]}>Refresh</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Workout row ──────────────────────────────────────────────────────────────

function WorkoutItem({
  item,
  units,
  onToggle,
}: {
  item: WorkoutRow;
  units: 'km' | 'mi';
  onToggle: () => void;
}) {
  const sportColor = SPORT_COLOR[item.sport] ?? colors.accent;
  const date = new Date(item.startedAt);
  const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable
      style={[
        styles.workoutRow,
        item.selected && styles.workoutRowSelected,
        item.alreadyImported && styles.workoutRowDimmed,
      ]}
      onPress={onToggle}
    >
      {/* Checkbox */}
      <View style={[styles.checkbox, item.selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        {item.selected && <Ionicons name="checkmark" size={14} color={colors.bg} />}
        {item.alreadyImported && <Ionicons name="checkmark-done" size={14} color={colors.textDim} />}
      </View>

      {/* Sport icon */}
      <View style={[styles.wrkIcon, { backgroundColor: sportColor + '22' }]}>
        <Ionicons name={SPORT_ICON[item.sport] as any} size={16} color={sportColor} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={type.body} numberOfLines={1}>{item.title}</Text>
        <Text style={type.caption}>{dateStr} · {timeStr}</Text>
      </View>

      {/* Stats */}
      <View style={styles.wrkStats}>
        {item.distanceM > 0 && (
          <Text style={styles.wrkStat}>
            {formatDistance(item.distanceM, units)} {distanceUnit(units)}
          </Text>
        )}
        <Text style={styles.wrkStat}>{formatDuration(item.durationS)}</Text>
        {item.avgHeartRate && (
          <Text style={[styles.wrkStat, { color: '#FF2D55' }]}>❤️ {item.avgHeartRate}</Text>
        )}
      </View>

      {/* Source badge */}
      <Text style={styles.sourceBadge}>
        {item.source === 'apple_health' ? '🍎' : '🔗'}
      </Text>
    </Pressable>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: 'watch',
    title: 'Apple Watch & Wear OS',
    desc: 'Workouts recorded on your watch sync automatically.',
  },
  {
    icon: 'bluetooth',
    title: 'Garmin, Fitbit & more',
    desc: 'Any device that writes to Apple Health or Health Connect works instantly.',
  },
  {
    icon: 'apps',
    title: 'Other fitness apps',
    desc: 'Strava, Nike Run Club, Runkeeper — if they write to Health, we can read them.',
  },
  {
    icon: 'heart',
    title: 'Heart rate included',
    desc: 'HR data from your watch is imported alongside each workout.',
  },
  {
    icon: 'lock-closed',
    title: 'Private & on-device',
    desc: 'Health data stays on your device. Athlr never uploads it.',
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    margin: spacing.m,
    marginBottom: 0,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.m,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.m,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.s,
  },

  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.m,
  },
  howIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },

  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    margin: spacing.m,
    marginBottom: 0,
    backgroundColor: colors.live + '22',
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.live + '66',
  },
  errorBanner: {
    margin: spacing.m,
    marginBottom: 0,
    backgroundColor: colors.danger + '22',
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.danger + '66',
  },
  errorAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  errorActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    margin: spacing.m,
    marginBottom: 0,
    padding: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginTop: spacing.m,
  },
  toolbarActions: { flexDirection: 'row', gap: spacing.m },
  toolbarBtn: { color: colors.accent, fontWeight: '700', fontSize: 14 },

  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.s,
  },
  workoutRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '11',
  },
  workoutRowDimmed: { opacity: 0.45 },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrkStats: { alignItems: 'flex-end', gap: 2 },
  wrkStat: { fontSize: 12, color: colors.textDim, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sourceBadge: { fontSize: 16, marginLeft: 2 },

  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.l,
    backgroundColor: colors.bg + 'EE',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    borderRadius: radii.pill,
    paddingVertical: 16,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
