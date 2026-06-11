import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
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
import {
  formatDistance,
  formatDuration,
  formatPace,
  distanceUnit,
  paceUnit,
  SPORT_ICON,
  SPORT_LABEL,
  SPORT_COLOR,
} from '@/utils/format';
import { SportType } from '@/types';

const SPORTS: SportType[] = [
  'run', 'ride', 'walk', 'hike',
  'swim', 'cycling', 'workout', 'hiit',
  'yoga', 'tennis', 'other',
];

export default function RecordScreen() {
  useKeepAwake();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [region, setRegion] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const {
    state, sport, points, distanceM, movingS, elapsedS,
    currentPaceSPerKm, elevationGainM,
    units, setSport, start, pause, resume, tick, finish, discard,
  } = useRecordingStore();

  // 1 s clock while recording
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

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      start();
      startTracking();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, start]);

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
        'Background location is off — recording will pause if the screen locks. Enable "Allow all the time" in Settings.',
      );
    }
    setCountdown(3);
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

  const sportColor = SPORT_COLOR[sport] ?? colors.accent;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map */}
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
            <Polyline
              coordinates={routeCoords}
              strokeColor={sportColor}
              strokeWidth={5}
            />
          )}
        </MapView>

        {/* Sport picker — idle only */}
        {state === 'idle' && (
          <View style={styles.sportPickerWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sportPicker}
            >
              {SPORTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSport(s)}
                  style={[
                    styles.sportChip,
                    sport === s && { backgroundColor: SPORT_COLOR[s] + '33', borderColor: SPORT_COLOR[s] },
                  ]}
                >
                  <Ionicons
                    name={SPORT_ICON[s] as never}
                    size={16}
                    color={sport === s ? SPORT_COLOR[s] : colors.textDim}
                  />
                  <Text style={[styles.sportChipText, sport === s && { color: SPORT_COLOR[s] }]}>
                    {SPORT_LABEL[s]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Paused banner */}
        {state === 'paused' && (
          <View style={styles.pausedBanner}>
            <Text style={styles.pausedText}>⏸ PAUSED</Text>
          </View>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownNumber}>
              {countdown === 0 ? 'GO!' : countdown}
            </Text>
            <Text style={styles.countdownLabel}>Get ready</Text>
          </View>
        )}
      </View>

      {/* Stats panel */}
      <View style={styles.panel}>
        {/* Primary stat — distance */}
        <View style={styles.primaryStat}>
          <Text style={type.label}>{`Distance · ${distanceUnit(units)}`}</Text>
          <Text style={type.stat}>{formatDistance(distanceM, units)}</Text>
        </View>

        {/* Secondary row */}
        <View style={styles.statRow}>
          <View style={styles.statHalf}>
            <Text style={type.label}>Moving Time</Text>
            <Text style={type.statSmall}>{formatDuration(movingS)}</Text>
          </View>
          <View style={styles.statHalf}>
            <Text style={type.label}>{`Pace · ${paceUnit(units)}`}</Text>
            <Text style={type.statSmall}>{formatPace(currentPaceSPerKm, units)}</Text>
          </View>
        </View>

        {/* Tertiary row — elevation + elapsed */}
        {state !== 'idle' && (
          <View style={styles.statRow}>
            <View style={styles.statHalf}>
              <Text style={type.label}>Elev Gain · m</Text>
              <Text style={[type.statSmall, styles.smallStat]}>
                {Math.round(elevationGainM)}
              </Text>
            </View>
            <View style={styles.statHalf}>
              <Text style={type.label}>Elapsed</Text>
              <Text style={[type.statSmall, styles.smallStat]}>{formatDuration(elapsedS)}</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {state === 'idle' && (
            <Pressable style={[styles.startButton, { backgroundColor: sportColor }]} onPress={onStart}>
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

  sportPickerWrap: {
    position: 'absolute',
    top: spacing.m,
    left: 0,
    right: 0,
  },
  sportPicker: {
    paddingHorizontal: spacing.m,
    gap: spacing.s,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface + 'EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sportChipText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },

  pausedBanner: {
    position: 'absolute',
    top: spacing.m,
    alignSelf: 'center',
    backgroundColor: colors.surface + 'EE',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pausedText: { ...type.label, color: colors.accent },

  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,18,32,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 100,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -4,
  },
  countdownLabel: {
    ...type.label,
    marginTop: spacing.s,
  },

  panel: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.m,
  },
  primaryStat: { alignItems: 'center' },
  statRow: { flexDirection: 'row' },
  statHalf: { flex: 1, alignItems: 'center' },
  smallStat: { fontSize: 22 },

  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.l,
    marginTop: spacing.s,
  },
  startButton: {
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
