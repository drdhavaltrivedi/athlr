import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listActivities } from '@/db/database';
import { ActivitySummary } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import {
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatPace,
  formatTime,
  SPORT_ICON,
  SPORT_LABEL,
} from '@/utils/format';

export default function ActivitiesScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      listActivities().then(setActivities).catch(console.warn);
    }, []),
  );

  if (activities.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="footsteps" size={48} color={colors.textDim} />
        <Text style={styles.emptyTitle}>No activities yet</Text>
        <Text style={type.caption}>
          Hit Record to track your first run, ride or walk.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/activity/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={SPORT_ICON[item.sport] as never}
                size={18}
                color={colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{item.title}</Text>
              <Text style={type.caption}>
                {formatDate(item.startedAt)} · {formatTime(item.startedAt)} ·{' '}
                {SPORT_LABEL[item.sport]}
              </Text>
            </View>
            {item.visibility === 'private' && (
              <Ionicons name="lock-closed" size={14} color={colors.textDim} />
            )}
          </View>
          <View style={styles.cardStats}>
            <Stat label="Distance" value={`${formatDistanceKm(item.distanceM)} km`} />
            <Stat label="Time" value={formatDuration(item.movingS)} />
            <Stat label="Pace" value={`${formatPace(item.avgPaceSPerKm)} /km`} />
          </View>
        </Pressable>
      )}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.bg,
  },
  emptyTitle: { ...type.title, marginTop: spacing.s },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStats: { flexDirection: 'row', gap: spacing.m },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
