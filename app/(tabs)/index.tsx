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
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listActivities } from '@/db/database';
import { getCommunityFeed, toggleKudo } from '@/services/cloudSyncService';
import { useAuthStore } from '@/store/authStore';
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
  const [feedType, setFeedType] = useState<'me' | 'community'>('me');
  const [refreshing, setRefreshing] = useState(false);
  
  const { user } = useAuthStore();

  const load = useCallback(async (currentFeed: 'me' | 'community', sport?: string) => {
    let data;
    if (currentFeed === 'me') {
      data = await listActivities(100, sport === 'all' ? undefined : sport).catch(() => []);
    } else {
      data = await getCommunityFeed();
      if (sport && sport !== 'all') {
        data = data.filter((a: any) => a.sport === sport);
      }
    }
    setActivities(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(feedType, filter);
    }, [load, filter, feedType]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(feedType, filter);
    setRefreshing(false);
  };

  const onFilterChange = (key: string) => {
    setFilter(key);
  };

  const onFeedTypeChange = (type: 'me' | 'community') => {
    if (type === 'community' && !user) {
      Alert.alert(
        'Login Required',
        'You must be logged in to view the community feed.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/auth') },
        ]
      );
      return;
    }
    setFeedType(type);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Feed Toggle */}
      <View style={styles.feedToggleWrap}>
        <View style={styles.feedToggle}>
          <Pressable
            style={[styles.feedToggleBtn, feedType === 'me' && styles.feedToggleBtnActive]}
            onPress={() => onFeedTypeChange('me')}
          >
            <Text style={[styles.feedToggleText, feedType === 'me' && styles.feedToggleTextActive]}>Me</Text>
          </Pressable>
          <Pressable
            style={[styles.feedToggleBtn, feedType === 'community' && styles.feedToggleBtnActive]}
            onPress={() => onFeedTypeChange('community')}
          >
            <Text style={[styles.feedToggleText, feedType === 'community' && styles.feedToggleTextActive]}>Community</Text>
          </Pressable>
        </View>
      </View>

      {/* Filter bar */}
      <View>
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
      </View>

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
  const [kudos, setKudos] = useState(item.kudosCount || 0);
  const [given, setGiven] = useState(false);

  const handleKudo = async (e: any) => {
    e.stopPropagation();
    // Optimistic UI update
    const newGiven = !given;
    setGiven(newGiven);
    setKudos((k: number) => newGiven ? k + 1 : k - 1);
    const success = await toggleKudo(item.id);
    if (!success) {
      // revert if failed
      setGiven(!newGiven);
      setKudos((k: number) => !newGiven ? k + 1 : k - 1);
    }
  };

  return (
    <Pressable style={[styles.card, { borderLeftColor: sportColor, borderLeftWidth: 3 }]} onPress={onPress}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: sportColor + '22' }]}>
          <Ionicons name={SPORT_ICON[item.sport] as never} size={18} color={sportColor} />
        </View>
        <View style={{ flex: 1 }}>
          {item.userName && (
            <Text style={[type.caption, { color: sportColor, fontWeight: '600', marginBottom: 2 }]}>
              {item.userName}
            </Text>
          )}
          <Text style={type.title} numberOfLines={1}>{item.title}</Text>
          <Text style={type.caption}>
            {formatDate(item.startedAt)} · {formatTime(item.startedAt)}
          </Text>
        </View>
        {item.visibility === 'private' && (
          <Ionicons name="lock-closed" size={14} color={colors.textDim} />
        )}
      </View>

      {/* Map Thumbnail */}
      {!!item.mapUrl && (
        <View style={styles.mapWrap}>
          <Image source={{ uri: item.mapUrl }} style={styles.mapThumb} />
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCell label={`Distance · ${distanceUnit(units)}`} value={formatDistance(item.distanceM, units)} />
        <StatCell label="Moving Time" value={formatDuration(item.movingS)} />
        <StatCell label={`Pace · ${paceUnit(units)}`} value={formatPace(item.avgPaceSPerKm, units)} />
        <StatCell label="Elev · m" value={String(Math.round(item.elevationGainM))} />
    </View>

      {/* Kudos Footer */}
      <View style={styles.cardFooter}>
        <Pressable style={styles.kudoBtn} onPress={handleKudo}>
          <Ionicons 
            name={given ? "heart" : "heart-outline"} 
            size={20} 
            color={given ? colors.accent : colors.textDim} 
          />
          <Text style={[styles.kudoText, given && { color: colors.accent }]}>
            {kudos} {kudos === 1 ? 'Kudo' : 'Kudos'}
          </Text>
        </Pressable>
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

  feedToggleWrap: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
  },
  feedToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  feedToggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  feedToggleText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  feedToggleTextActive: {
    color: colors.text,
    fontWeight: '700',
  },

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
  mapWrap: {
    height: 140,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: spacing.m,
  },
  mapThumb: {
    width: '100%',
    height: '100%',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.m,
    marginTop: spacing.m,
    flexDirection: 'row',
  },
  kudoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: spacing.m,
    gap: 6,
  },
  kudoText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
