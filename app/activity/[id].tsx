import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT, LocalTile } from 'react-native-maps';
import { LineChart } from 'react-native-chart-kit';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { deleteActivity, getActivity, updateTitle, updateVisibility } from '@/db/database';
import { Activity, ActivityVisibility, SegmentEffort } from '@/types';
import { exportAndShareGpx } from '@/utils/gpx';
import ShareCard from '@/components/ShareCard';
import * as healthService from '@/services/healthService';
import * as mapCache from '@/services/mapCacheService';
import * as segmentService from '@/services/segmentService';
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [segmentEfforts, setSegmentEfforts] = useState<SegmentEffort[]>([]);
  const shareCardRef = React.useRef<View>(null);

  useEffect(() => {
    if (id) {
      getActivity(id).then((data) => {
        setActivity(data);
        segmentService.getEffortsForActivity(id).then(setSegmentEfforts);
      }).catch(console.warn);
    }
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

  const onShareImage = async () => {
    if (!shareCardRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      
      // Delay slightly to ensure map tiles in the offscreen component have time to load
      await new Promise(r => setTimeout(r, 800));

      const uri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.9,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share your activity',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (err) {
      console.warn('Share image error:', err);
      Alert.alert('Error', 'Could not generate share image');
    } finally {
      setIsCapturing(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete Activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteActivity(id as string);
        router.back();
      }},
    ]);
  };

  const onSyncHealth = async () => {
    if (!activity) return;
    const success = await healthService.syncActivityToHealth(activity);
    if (success) {
      Alert.alert('Success', 'Activity synced to Apple Health / Google Fit!');
    } else {
      Alert.alert('Permission Denied', 'Please enable Health permissions in your device settings.');
    }
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
            <LocalTile 
              pathTemplate={mapCache.getLocalTileUrlTemplate()} 
              tileSize={256}
              zIndex={-1} 
            />
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

          {/* Charts */}
          {activity.points && activity.points.length > 10 && (
            <View style={styles.chartsContainer}>
              <Text style={[type.h3, { marginBottom: spacing.m }]}>Elevation & Pace</Text>
              
              {/* Elevation Chart */}
              <LineChart
                data={{
                  labels: [],
                  datasets: [{
                    data: (() => {
                      const pts = activity.points;
                      const step = Math.max(1, Math.floor(pts.length / 50));
                      const downsamp = pts.filter((_, i) => i % step === 0 && pts[i].altitude != null);
                      return downsamp.length > 0 ? downsamp.map(p => p.altitude!) : [0, 0];
                    })()
                  }]
                }}
                width={Dimensions.get("window").width - spacing.l * 2}
                height={180}
                withDots={false}
                withInnerLines={false}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(130, 255, 130, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForBackgroundLines: { strokeWidth: 0 },
                }}
                bezier
                style={{ borderRadius: radii.card, marginBottom: spacing.l }}
              />

              {/* Pace Chart */}
              <LineChart
                data={{
                  labels: [],
                  datasets: [{
                    data: (() => {
                      const pts = activity.points;
                      const step = Math.max(1, Math.floor(pts.length / 50));
                      const downsamp = pts.filter((_, i) => i % step === 0);
                      // Calculate pace between downsampled points
                      const paces: number[] = [];
                      for(let i = 1; i < downsamp.length; i++) {
                        const p1 = downsamp[i-1];
                        const p2 = downsamp[i];
                        const dt = (p2.timestamp - p1.timestamp) / 1000;
                        if(dt <= 0) { paces.push(paces[paces.length-1]||0); continue; }
                        
                        // Rough distance
                        const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
                        const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
                        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(p1.latitude*Math.PI/180)*Math.cos(p2.latitude*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const distM = 6371e3 * c;
                        
                        if(distM < 1) { paces.push(paces[paces.length-1]||0); continue; }
                        
                        const speed = distM / dt; // m/s
                        // Pace in sec/km
                        const paceSecKm = 1000 / speed;
                        // Cap pace for chart readability (e.g., max 15 min/km = 900s)
                        paces.push(Math.min(paceSecKm, 900));
                      }
                      
                      // Moving average smoothing (window size 3)
                      const smoothed = paces.map((val, idx, arr) => {
                        const start = Math.max(0, idx - 1);
                        const end = Math.min(arr.length - 1, idx + 1);
                        let sum = 0;
                        for(let j=start; j<=end; j++) sum += arr[j];
                        return sum / (end - start + 1);
                      });
                      
                      // Inverse the chart because lower pace (faster) is "better"/higher
                      const maxPace = Math.max(...(smoothed.length ? smoothed : [1000]));
                      return smoothed.length > 0 ? smoothed.map(p => maxPace - p) : [0, 0];
                    })()
                  }]
                }}
                width={Dimensions.get("window").width - spacing.l * 2}
                height={180}
                withDots={false}
                withInnerLines={false}
                yAxisLabel="-"
                formatYLabel={() => ""} // Hide raw values since it's inverted
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(130, 180, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForBackgroundLines: { strokeWidth: 0 },
                }}
                bezier
                style={{ borderRadius: radii.card }}
              />
            </View>
          )}

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

          {/* Segments Section */}
          {segmentEfforts.length > 0 && (
            <View style={styles.segmentsCard}>
              <Text style={type.h3}>Segments ({segmentEfforts.length})</Text>
              {segmentEfforts.map(effort => (
                <Pressable 
                  key={effort.id} 
                  style={styles.segmentItem}
                  onPress={() => router.push(`/segment/${effort.segmentId}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>{effort.segmentName || 'Unknown Segment'}</Text>
                    <Text style={type.caption}>{formatDuration(effort.elapsedTimeS)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <ActionButton icon="share-outline" label="Text" onPress={onShare} />
            <ActionButton 
              icon="image-outline" 
              label={isCapturing ? "..." : "Image"} 
              onPress={onShareImage} 
            />
            <ActionButton icon="download-outline" label="GPX" onPress={() => exportAndShareGpx(activity)} />
            <ActionButton icon="map-outline" label="Segment" onPress={() => router.push(`/segment/create/${activity.id}`)} />
            <ActionButton icon="heart-outline" label="Health" onPress={onSyncHealth} />
            <ActionButton icon="trash-outline" label="Delete" onPress={onDelete} danger />
          </View>
        </View>
      </ScrollView>
      <ShareCard ref={shareCardRef} activity={activity} units={units} />
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

  chartsContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.s,
  },
  segmentsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.s,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.s },
  actionButton: {
    width: '48%',
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
