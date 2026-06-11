import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteActivity, getActivity, updateTitle, updateVisibility } from '@/db/database';
import { Activity, ActivityVisibility } from '@/types';
import { exportAndShareGpx } from '@/utils/gpx';
import { colors, radii, spacing, type } from '@/theme';
import { useRecordingStore } from '@/store/recordingStore';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
  formatTime,
  SPORT_COLOR,
  SPORT_LABEL,
  distanceUnit,
  paceUnit,
} from '@/utils/format';

const VISIBILITY_OPTIONS: Array<{ value: ActivityVisibility; label: string; icon: string }> = [
  { value: 'private',   label: 'Only me',  icon: 'lock-closed' },
  { value: 'followers', label: 'Followers', icon: 'people' },
  { value: 'everyone',  label: 'Everyone', icon: 'globe' },
];

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const units = useRecordingStore((s) => s.units);
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

  const sportColor = SPORT_COLOR[activity.sport] ?? colors.accent;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const onEditTitle = () => {
    Alert.prompt(
      'Rename Activity',
      undefined,
      async (text) => {
        if (!text?.trim()) return;
        await updateTitle(activity.id, text.trim());
        setActivity((a) => a ? { ...a, title: text.trim() } : a);
      },
      'plain-text',
      activity.title,
    );
  };

  const onChangeVisibility = () => {
    const options = VISIBILITY_OPTIONS.map((o) => o.label);
    Alert.alert(
      'Who can see this?',
      undefined,
      [
        ...VISIBILITY_OPTIONS.map((o) => ({
          text: o.label + (activity.visibility === o.value ? ' ✓' : ''),
          onPress: async () => {
            await updateVisibility(activity.id, o.value);
            setActivity((a) => a ? { ...a, visibility: o.value } : a);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const onShare = async () => {
    const distStr = formatDistance(activity.distanceM, units);
    const unit = distanceUnit(units);
    const pace = formatPace(activity.avgPaceSPerKm, units);
    await Share.share({
      message: [
        `🏃 ${activity.title}`,
        `📍 ${distStr} ${unit}  ⏱ ${formatDuration(activity.movingS)}  ⚡ ${pace} /${unit}`,
        `🏔 ${activity.elevationGainM} m elevation gain`,
        `📅 ${formatDate(activity.startedAt)} · ${formatTime(activity.startedAt)}`,
        `\nTracked with Athlr 🔥`,
      ].join('\n'),
    });
  };

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

  // ─── Render ─────────────────────────────────────────────────────────────────

  const visOpt = VISIBILITY_OPTIONS.find((o) => o.value === activity.visibility);

  return (
    <>
      <Stack.Screen
        options={{
          title: activity.title,
          headerRight: () => (
            <Pressable onPress={onEditTitle} style={{ marginRight: spacing.m }}>
              <Ionicons name="pencil" size={20} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Map */}
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
              <Polyline coordinates={coords} strokeColor={sportColor} strokeWidth={4} />
            )}
          </MapView>

          {/* Sport badge overlay */}
          <View style={[styles.sportBadge, { borderColor: sportColor }]}>
            <Text style={[styles.sportBadgeText, { color: sportColor }]}>
              {SPORT_LABEL[activity.sport]}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Date + visibility */}
          <View style={styles.metaRow}>
            <Text style={type.caption}>
              {formatDate(activity.startedAt)} · {formatTime(activity.startedAt)}
            </Text>
            <Pressable style={styles.visibilityBadge} onPress={onChangeVisibility}>
              <Ionicons name={visOpt?.icon as never ?? 'lock-closed'} size={12} color={colors.textDim} />
              <Text style={styles.visibilityText}>{visOpt?.label ?? 'Private'}</Text>
            </Pressable>
          </View>

          {/* 4-stat grid */}
          <View style={styles.statGrid}>
            <StatTile label={`Distance · ${distanceUnit(units)}`} value={formatDistance(activity.distanceM, units)} color={sportColor} />
            <StatTile label="Moving Time" value={formatDuration(activity.movingS)} color={sportColor} />
            <StatTile label={`Avg Pace · ${paceUnit(units)}`} value={formatPace(activity.avgPaceSPerKm, units)} color={sportColor} />
            <StatTile label="Elevation · m" value={String(activity.elevationGainM)} color={sportColor} />
          </View>

          {/* Splits */}
          {activity.splits.length > 0 && (
            <View style={styles.card}>
              <Text style={type.label}>Splits</Text>
              {/* Header */}
              <View style={styles.splitHeader}>
                <Text style={[styles.splitCol, { width: 24 }]}>#</Text>
                <Text style={[styles.splitCol, { flex: 1 }]}>Pace</Text>
                <Text style={[styles.splitCol, { width: 56, textAlign: 'right' }]}>Elev</Text>
              </View>
              {activity.splits.map((s) => (
                <View key={s.index} style={styles.splitRow}>
                  <Text style={styles.splitIndex}>{s.index}</Text>
                  <View style={styles.splitBarWrap}>
                    <View
                      style={[
                        styles.splitBar,
                        { width: `${barWidth(s.paceSPerKm, activity)}%`, backgroundColor: sportColor },
                      ]}
                    />
                  </View>
                  <Text style={styles.splitPace}>{formatPace(s.paceSPerKm, units)}</Text>
                  <Text style={styles.splitElev}>
                    {s.elevationGainM > 0 ? `+${Math.round(s.elevationGainM)}m` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <ActionButton icon="share-outline" label="Share" onPress={onShare} />
            <ActionButton icon="download-outline" label="GPX" onPress={() => exportAndShareGpx(activity)} />
            <ActionButton icon="trash-outline" label="Delete" onPress={onDelete} danger />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={type.label}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon, label, onPress, danger,
}: {
  icon: string; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.actionButton, danger && styles.actionButtonDanger]}
      onPress={onPress}
    >
      <Ionicons name={icon as never} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  mapWrap: { height: 280, position: 'relative' },
  sportBadge: {
    position: 'absolute',
    top: spacing.m,
    left: spacing.m,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 4,
    backgroundColor: colors.bg + 'CC',
  },
  sportBadgeText: { fontSize: 12, fontWeight: '700' },

  body: { padding: spacing.m, gap: spacing.m },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
  },
  visibilityText: { fontSize: 12, color: colors.textDim, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  statItem: { width: '50%', paddingBottom: spacing.m },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.s,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  splitCol: { ...type.label },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginTop: spacing.s,
  },
  splitIndex: {
    width: 24,
    color: colors.textDim,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
  splitBarWrap: { flex: 1, height: 10, justifyContent: 'center' },
  splitBar: { height: 10, borderRadius: 5 },
  splitPace: {
    width: 52,
    textAlign: 'right',
    color: colors.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
  splitElev: {
    width: 48,
    textAlign: 'right',
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },

  actions: { flexDirection: 'row', gap: spacing.s },
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
  actionButtonDanger: { borderColor: colors.danger + '66' },
  actionText: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
