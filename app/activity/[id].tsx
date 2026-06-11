import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteActivity, getActivity } from '@/db/database';
import { Activity } from '@/types';
import { exportAndShareGpx } from '@/utils/gpx';
import { colors, radii, spacing, type } from '@/theme';
import {
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatPace,
  formatTime,
} from '@/utils/format';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (id) getActivity(id).then(setActivity).catch(console.warn);
  }, [id]);

  if (!activity) {
    return (
      <View style={styles.loading}>
        <Text style={type.caption}>Loading…</Text>
      </View>
    );
  }

  const coords = activity.points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const region =
    coords.length > 0
      ? fitRegion(coords)
      : { latitude: 0, longitude: 0, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const onDelete = () => {
    Alert.alert('Delete activity?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(activity.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: activity.title }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            userInterfaceStyle="dark"
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {coords.length > 1 && (
              <Polyline coordinates={coords} strokeColor={colors.route} strokeWidth={4} />
            )}
          </MapView>
        </View>

        <View style={styles.body}>
          <Text style={type.caption}>
            {formatDate(activity.startedAt)} · {formatTime(activity.startedAt)}
          </Text>

          <View style={styles.statGrid}>
            <Stat label="Distance · km" value={formatDistanceKm(activity.distanceM)} />
            <Stat label="Moving time" value={formatDuration(activity.movingS)} />
            <Stat label="Avg pace · /km" value={formatPace(activity.avgPaceSPerKm)} />
            <Stat label="Elevation · m" value={String(activity.elevationGainM)} />
          </View>

          {activity.splits.length > 0 && (
            <View style={styles.card}>
              <Text style={type.label}>Splits</Text>
              {activity.splits.map((s) => (
                <View key={s.index} style={styles.splitRow}>
                  <Text style={styles.splitIndex}>{s.index}</Text>
                  <View style={styles.splitBarWrap}>
                    <View
                      style={[
                        styles.splitBar,
                        { width: `${barWidth(s.paceSPerKm, activity)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.splitPace}>{formatPace(s.paceSPerKm)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={() => exportAndShareGpx(activity)}>
              <Ionicons name="download-outline" size={18} color={colors.text} />
              <Text style={styles.actionText}>Export GPX</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** Pace bar width relative to the slowest split (slow = long bar). */
function barWidth(pace: number, a: Activity): number {
  const paces = a.splits.map((s) => s.paceSPerKm);
  const max = Math.max(...paces);
  const min = Math.min(...paces);
  if (max === min) return 70;
  return 30 + ((pace - min) / (max - min)) * 60;
}

function fitRegion(coords: { latitude: number; longitude: number }[]) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.005, (maxLng - minLng) * 1.4),
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  mapWrap: { height: 260 },
  body: { padding: spacing.m, gap: spacing.m },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', marginBottom: spacing.m },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.s,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    marginTop: spacing.s,
  },
  splitIndex: {
    width: 24,
    color: colors.textDim,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  splitBarWrap: { flex: 1, height: 10, justifyContent: 'center' },
  splitBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  splitPace: {
    width: 56,
    textAlign: 'right',
    color: colors.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: spacing.m },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteButton: { borderColor: colors.danger },
  actionText: { color: colors.text, fontWeight: '600' },
});
