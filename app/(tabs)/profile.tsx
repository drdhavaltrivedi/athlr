import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { lifetimeStats, LifetimeStats } from '@/db/database';
import { useRecordingStore } from '@/store/recordingStore';
import { colors, radii, spacing, type } from '@/theme';
import { formatDistanceKm, formatDuration } from '@/utils/format';

export default function ProfileScreen() {
  const [stats, setStats] = useState<LifetimeStats>({
    count: 0,
    distanceM: 0,
    movingS: 0,
    elevationGainM: 0,
  });
  const autoPause = useRecordingStore((s) => s.autoPause);
  const setAutoPause = useRecordingStore((s) => s.setAutoPause);

  useFocusEffect(
    useCallback(() => {
      lifetimeStats().then(setStats).catch(console.warn);
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <View style={styles.card}>
        <Text style={type.label}>All time</Text>
        <View style={styles.grid}>
          <Big label="Activities" value={String(stats.count)} />
          <Big label="Distance · km" value={formatDistanceKm(stats.distanceM, 1)} />
          <Big label="Moving time" value={formatDuration(stats.movingS)} />
          <Big label="Elevation · m" value={String(Math.round(stats.elevationGainM))} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={type.label}>Recording</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Auto-pause</Text>
            <Text style={type.caption}>Pause the clock when you stop moving</Text>
          </View>
          <Switch
            value={autoPause}
            onValueChange={setAutoPause}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
            thumbColor={colors.text}
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.promiseHeader}>
          <Ionicons name="shield-checkmark" size={18} color={colors.live} />
          <Text style={[type.label, { color: colors.live }]}>Our promise</Text>
        </View>
        <Text style={[type.body, { marginTop: spacing.s }]}>
          Activities are private by default. Your data stays on this device
          until you choose to share it, and you can export everything as GPX
          any time — free, forever.
        </Text>
      </View>
    </ScrollView>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.bigValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.m,
  },
  gridItem: { width: '50%', marginBottom: spacing.m },
  bigValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.m,
    gap: spacing.m,
  },
  promiseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});
