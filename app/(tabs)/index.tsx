import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listActivities } from '@/db/database';
import { ActivitySummary, SportType } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
  formatTime,
  distanceUnit,
  paceUnit,
  SPORT_ICON,
  SPORT_LABEL,
  SPORT_COLOR,
} from '@/utils/format';
import { useRecordingStore } from '@/store/recordingStore';

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'run', label: '🏃 Run' },
  { key: 'ride', label: '🚴 Ride' },
  { key: 'walk', label: '🚶 Walk' },
  { key: 'hike', label: '🥾 Hike' },
  { key: 'swim', label: '🏊 Swim' },
  { key: 'workout', label: '🏋️ Workout' },
  { key: 'hiit', label: '🔥 HIIT' },
  { key: 'yoga', label: '🧘 Yoga' },
];

export default function ActivitiesScreen() {
  const router = useRouter();
  const units = useRecordingStore((s) => s.units);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (sport?: string) => {
    const data = await listActivities(100, sport === 'all' ? undefined : sport).catch(() => []);
    setActivities(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  };

  const onFilterChange = (key: string) => {
    setFilter(key);
    load(key);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => onFilterChange(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {activities.length === 0 ? (
        <EmptyState filter={filter} onRecord={() => router.push('/record')} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <ActivityCard
              item={item}
              units={units}
              onPress={() => router.push(`/activity/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  item,
  units,
  onPress,
}: {
  item: ActivitySummary;
  units: 'km' | 'mi';
  onPress: () => void;
}) {
  const sportColor = SPORT_COLOR[item.sport] ?? colors.accent;

  return (
    <Pressable style={[styles.card, { borderLeftColor: sportColor, borderLeftWidth: 3 }]} onPress={onPress}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: sportColor + '22' }]}>
          <Ionicons name={SPORT_ICON[item.sport] as never} size={18} color={sportColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{item.title}</Text>
          <Text style={type.caption}>
            {formatDate(item.startedAt)} · {formatTime(item.startedAt)} · {SPORT_LABEL[item.sport]}
          </Text>
        </View>
        {item.visibility === 'private' && (
          <Ionicons name="lock-closed" size={14} color={colors.textDim} />
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCell label={`Distance · ${distanceUnit(units)}`} value={formatDistance(item.distanceM, units)} />
        <StatCell label="Moving Time" value={formatDuration(item.movingS)} />
        <StatCell label={`Pace · ${paceUnit(units)}`} value={formatPace(item.avgPaceSPerKm, units)} />
        <StatCell label="Elev · m" value={String(Math.round(item.elevationGainM))} />
      </View>
    </Pressable>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={type.label} numberOfLines={1}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filter, onRecord }: { filter: string; onRecord: () => void }) {
  const isFiltered = filter !== 'all';
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="footsteps" size={42} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>
        {isFiltered ? `No ${SPORT_LABEL[filter] ?? filter} activities yet` : 'No activities yet'}
      </Text>
      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.s }]}>
        {isFiltered
          ? 'Try a different sport filter or record your first one.'
          : 'Hit Record to track your first run, ride or walk.'}
      </Text>
      {!isFiltered && (
        <Pressable style={styles.recordCta} onPress={onRecord}>
          <Text style={styles.recordCtaText}>Start Recording</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 52,
  },
  filterBarContent: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    gap: spacing.s,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accent + '22',
    borderColor: colors.accent,
  },
  filterText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.accent },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: { width: '50%', marginBottom: spacing.s },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.s,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
  },
  emptyTitle: { ...type.title, textAlign: 'center' },
  recordCta: {
    marginTop: spacing.m,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    borderRadius: radii.pill,
  },
  recordCtaText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
