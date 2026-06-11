import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useRecordingStore } from '@/store/recordingStore';
import {
  getCurrentPosition,
  requestPermissions,
  startTracking,
  stopTracking,
} from '@/services/locationService';
import { colors, radii, spacing, type } from '@/theme';
import { formatDistanceKm, formatDuration, formatPace, SPORT_LABEL } from '@/utils/format';
import { SportType } from '@/types';

const SPORTS: SportType[] = ['run', 'ride', 'walk', 'hike'];

export default function RecordScreen() {
  useKeepAwake();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const {
    state, sport, points, distanceM, movingS, currentPaceSPerKm,
    setSport, start, pause, resume, tick, finish, discard,
  } = useRecordingStore();

  // 1s clock while recording
  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [state, tick]);

  // Center map on user before starting
  useEffect(() => {
    (async () => {
      const fix = await getCurrentPosition();
      if (fix) {
        setRegion((r) => ({ ...r, latitude: fix.latitude, longitude: fix.longitude }));
      }
    })();
  }, []);

  // Follow the athlete while recording
  useEffect(() => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    mapRef.current?.animateCamera(
      { center: { latitude: last.latitude, longitude: last.longitude } },
      { duration: 500 },
    );
  }, [points.length]);

  const onStart = async () => {
    const perms = await requestPermissions();
    if (!perms.foreground) {
      Alert.alert(
        'Location needed',
        'Athlr needs location access to record your activity. Enable it in Settings.',
      );
      return;
    }
    if (!perms.background) {
      Alert.alert(
        'Heads up',
        'Background location is off — recording will pause if the screen locks. You can enable "Allow all the time" in Settings.',
      );
    }
    start();
    await startTracking();
  };

  const onFinish = () => {
    Alert.alert('Finish activity?', undefined, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await stopTracking();
          discard();
        },
      },
      {
        text: 'Save',
        onPress: async () => {
          await stopTracking();
          const activity = await finish();
          if (activity) {
            router.push(`/activity/${activity.id}`);
          } else {
            Alert.alert('Too short', 'Activity was under 50 m / 30 s, so it was not saved.');
          }
        },
      },
    ]);
  };

  const routeCoords = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation
          userInterfaceStyle="dark"
        >
          {routeCoords.length > 1 && (
            <Polyline coordinates={routeCoords} strokeColor={colors.route} strokeWidth={5} />
          )}
        </MapView>

        {state === 'idle' && (
          <View style={styles.sportPicker}>
            {SPORTS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSport(s)}
                style={[styles.sportChip, sport === s && styles.sportChipActive]}
              >
                <Text style={[styles.sportChipText, sport === s && styles.sportChipTextActive]}>
                  {SPORT_LABEL[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {state === 'paused' && (
          <View style={styles.pausedBanner}>
            <Text style={styles.pausedText}>PAUSED</Text>
          </View>
        )}
      </View>

      {/* Stats panel — the signature: numbers carry the screen */}
      <View style={styles.panel}>
        <View style={styles.statRow}>
          <View style={styles.statMain}>
            <Text style={type.label}>Distance · km</Text>
            <Text style={type.stat}>{formatDistanceKm(distanceM)}</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statHalf}>
            <Text style={type.label}>Time</Text>
            <Text style={type.statSmall}>{formatDuration(movingS)}</Text>
          </View>
          <View style={styles.statHalf}>
            <Text style={type.label}>Pace · /km</Text>
            <Text style={type.statSmall}>{formatPace(currentPaceSPerKm)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          {state === 'idle' && (
            <Pressable style={styles.startButton} onPress={onStart}>
              <Text style={styles.startText}>START</Text>
            </Pressable>
          )}
          {state === 'recording' && (
            <>
              <Pressable style={styles.secondaryButton} onPress={() => pause()}>
                <Ionicons name="pause" size={28} color={colors.text} />
              </Pressable>
              <Pressable style={styles.stopButton} onPress={onFinish}>
                <Ionicons name="stop" size={28} color={colors.bg} />
              </Pressable>
            </>
          )}
          {state === 'paused' && (
            <>
              <Pressable style={styles.resumeButton} onPress={() => resume()}>
                <Ionicons name="play" size={28} color={colors.bg} />
              </Pressable>
              <Pressable style={styles.stopButton} onPress={onFinish}>
                <Ionicons name="stop" size={28} color={colors.bg} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 1 },
  sportPicker: {
    position: 'absolute',
    top: spacing.m,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  sportChip: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
  },
  sportChipActive: { backgroundColor: colors.accent },
  sportChipText: { color: colors.textDim, fontWeight: '600' },
  sportChipTextActive: { color: colors.bg },
  pausedBanner: {
    position: 'absolute',
    top: spacing.m,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
  },
  pausedText: { ...type.label, color: colors.accent },
  panel: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statRow: { flexDirection: 'row', marginBottom: spacing.m },
  statMain: { flex: 1, alignItems: 'center' },
  statHalf: { flex: 1, alignItems: 'center' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.l,
    marginTop: spacing.s,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: radii.pill,
  },
  startText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  resumeButton: {
    backgroundColor: colors.live,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: colors.danger,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
