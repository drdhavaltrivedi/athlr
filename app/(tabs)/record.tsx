import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT, LocalTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useRecordingStore } from '@/store/recordingStore';
import * as mapCache from '@/services/mapCacheService';
import {
  getCurrentPosition,
  requestPermissions,
  setPausedProfile,
  startTracking,
  stopTracking,
  watchAccuracy,
} from '@/services/locationService';
import { notifySuccess, tapHeavy, tapLight, tapMedium } from '@/utils/haptics';
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

/** Sports recorded by time only — no GPS, no map, no location permission. */
const INDOOR_SPORTS = new Set<SportType>(['yoga', 'workout', 'hiit']);

export default function RecordScreen() {
  useKeepAwake();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  // null = no GPS fix yet → show the locating placeholder, not San Francisco
  const [region, setRegion] = useState<{
    latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number;
  } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState(false);

  const {
    state, sport, points, distanceM, movingS, elapsedS,
    currentPaceSPerKm, elevationGainM, pausedBy,
    units, setSport, start, pause, resume, tick, finish, discard,
  } = useRecordingStore();

  const indoor = INDOOR_SPORTS.has(sport);

  // 1 s clock for the whole session — elapsed keeps counting through pauses
  useEffect(() => {
    if (state === 'idle') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [state, tick]);

  // Center map on user before starting
  useEffect(() => {
    if (indoor) return;
    (async () => {
      const fix = await getCurrentPosition();
      if (fix) {
        setRegion({
          latitude: fix.latitude,
          longitude: fix.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    })();
  }, [indoor]);

  // GPS signal indicator while waiting to start (outdoor only)
  useEffect(() => {
    if (indoor || state !== 'idle') return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      sub = await watchAccuracy((acc) => {
        setGpsAccuracy(acc);
        setGpsAvailable(true);
      });
      if (!sub && !cancelled) setGpsAvailable(false);
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [indoor, state]);

  // Follow the athlete while recording
  useEffect(() => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    mapRef.current?.animateCamera(
      { center: { latitude: last.latitude, longitude: last.longitude } },
      { duration: 500 },
    );
  }, [points.length]);

  // Countdown timer — every beat has a haptic, GO! hits hard
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      tapHeavy();
      setCountdown(null);
      start();
      if (!indoor) startTracking();
      return;
    }
    tapLight();
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, start, indoor]);

  const onStart = async () => {
    // Indoor sessions are time-only: no GPS, no permission needed
    if (indoor) {
      setCountdown(3);
      return;
    }
    const perms = await requestPermissions();
    if (!perms.foreground) {
      Alert.alert(
        'Location Access Required',
        'Athlr needs location access to track your run. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }
    if (!perms.background) {
      Alert.alert(
        'Heads up',
        'Background location is off — recording will pause if the screen locks. Enable "Allow all the time" in Settings.',
      );
    }
    // Grab a fix now so the map is centered by the time the countdown ends
    getCurrentPosition().then((fix) => {
      if (fix) {
        setRegion({
          latitude: fix.latitude,
          longitude: fix.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    });
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
            notifySuccess();
            router.push(`/activity/${activity.id}`);
          } else {
            Alert.alert('Too short', 'Activity was under 50 m / 30 s, so it was not saved.');
          }
        },
      },
    ]);
  };

  const onPause = () => {
    tapMedium();
    pause();
    // Manual pause = athlete chose to stop; save battery.
    if (!indoor) setPausedProfile(true).catch(() => {});
  };

  const onResume = () => {
    tapMedium();
    resume();
    if (!indoor) setPausedProfile(false).catch(() => {});
  };

  const routeCoords = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const sportColor = SPORT_COLOR[sport] ?? colors.accent;
  const tileTemplate = mapCache.getLocalTileUrlTemplate();

  const gpsQuality =
    !gpsAvailable || gpsAccuracy == null
      ? { label: 'GPS · waiting', color: colors.textDim }
      : gpsAccuracy <= 15
        ? { label: `GPS · good ±${Math.round(gpsAccuracy)}m`, color: colors.live }
        : gpsAccuracy <= 30
          ? { label: `GPS · ok ±${Math.round(gpsAccuracy)}m`, color: colors.accent }
          : { label: `GPS · weak ±${Math.round(gpsAccuracy)}m`, color: colors.danger };

  const sportPicker = state === 'idle' && (
    <View style={styles.sportPickerWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sportPicker}
      >
        {SPORTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => { tapLight(); setSport(s); }}
            accessibilityRole="button"
            accessibilityLabel={`Sport: ${SPORT_LABEL[s]}`}
            accessibilityState={{ selected: sport === s }}
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
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top half: map for outdoor sports, focus panel for indoor */}
      {indoor ? (
        <View style={styles.indoorWrap}>
          {sportPicker}
          <View style={styles.indoorCenter}>
            <View style={[styles.indoorIcon, { backgroundColor: sportColor + '22' }]}>
              <Ionicons name={SPORT_ICON[sport] as never} size={42} color={sportColor} />
            </View>
            <Text style={[type.title, { marginTop: spacing.m }]}>{SPORT_LABEL[sport]}</Text>
            <Text style={[type.caption, { marginTop: spacing.xs }]}>
              {state === 'idle' ? 'Time-based session · no GPS needed' : 'Session in progress'}
            </Text>
          </View>
          {state === 'paused' && (
            <View style={[styles.pausedBanner, { top: 80 }]}>
              <Text style={styles.pausedText}>⏸ PAUSED</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {region ? (
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
              <LocalTile
                pathTemplate={tileTemplate}
                tileSize={256}
                zIndex={-1}
              />
            </MapView>
          ) : (
            <View style={styles.locating}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[type.caption, { marginTop: spacing.s }]}>
                Finding your location…
              </Text>
            </View>
          )}

          {sportPicker}

          {/* GPS signal pill — idle only */}
          {state === 'idle' && (
            <View style={[styles.gpsPill, { borderColor: gpsQuality.color }]}>
              <View style={[styles.gpsDot, { backgroundColor: gpsQuality.color }]} />
              <Text style={[styles.gpsText, { color: gpsQuality.color }]}>
                {gpsQuality.label}
              </Text>
            </View>
          )}

          {/* Paused banner */}
          {state === 'paused' && (
            <View style={styles.pausedBanner}>
              <Text style={styles.pausedText}>
                {pausedBy === 'auto' ? '⏸ AUTO-PAUSED · move to resume' : '⏸ PAUSED'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Countdown overlay — tap anywhere to cancel */}
      {countdown !== null && (
        <Pressable
          style={styles.countdownOverlay}
          onPress={() => setCountdown(null)}
          accessibilityRole="button"
          accessibilityLabel="Cancel countdown"
        >
          <Text style={styles.countdownNumber}>
            {countdown === 0 ? 'GO!' : countdown}
          </Text>
          <Text style={styles.countdownLabel}>Tap to cancel</Text>
        </Pressable>
      )}

      {/* Stats panel */}
      <View style={styles.panel}>
        {indoor ? (
          <>
            {/* Indoor: time is the hero */}
            <View style={styles.primaryStat}>
              <Text style={type.label}>Duration</Text>
              <Text style={type.stat}>{formatDuration(movingS)}</Text>
            </View>
            {state !== 'idle' && (
              <View style={styles.statRow}>
                <View style={styles.statHalf}>
                  <Text style={type.label}>Elapsed</Text>
                  <Text style={[type.statSmall, styles.smallStat]}>{formatDuration(elapsedS)}</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Outdoor: distance is the hero */}
            <View style={styles.primaryStat}>
              <Text style={type.label}>{`Distance · ${distanceUnit(units)}`}</Text>
              <Text style={type.stat}>{formatDistance(distanceM, units)}</Text>
            </View>

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
          </>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {state === 'idle' && (
            <Pressable
              style={[styles.startButton, { backgroundColor: sportColor }]}
              onPress={onStart}
              accessibilityRole="button"
              accessibilityLabel={`Start recording ${SPORT_LABEL[sport]}`}
            >
              <Text style={styles.startText}>START</Text>
            </Pressable>
          )}
          {state === 'recording' && (
            <>
              <Pressable
                style={styles.secondaryButton}
                onPress={onPause}
                accessibilityRole="button"
                accessibilityLabel="Pause recording"
              >
                <Ionicons name="pause" size={28} color={colors.text} />
              </Pressable>
              <Pressable
                style={styles.stopButton}
                onPress={onFinish}
                accessibilityRole="button"
                accessibilityLabel="Finish activity"
              >
                <Ionicons name="stop" size={28} color={colors.bg} />
              </Pressable>
            </>
          )}
          {state === 'paused' && (
            <>
              <Pressable
                style={styles.resumeButton}
                onPress={onResume}
                accessibilityRole="button"
                accessibilityLabel="Resume recording"
              >
                <Ionicons name="play" size={28} color={colors.bg} />
              </Pressable>
              <Pressable
                style={styles.stopButton}
                onPress={onFinish}
                accessibilityRole="button"
                accessibilityLabel="Finish activity"
              >
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

  locating: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  indoorWrap: { flex: 1, backgroundColor: colors.bg },
  indoorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indoorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sportPickerWrap: {
    position: 'absolute',
    top: spacing.m,
    left: 0,
    right: 0,
    zIndex: 2,
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

  gpsPill: {
    position: 'absolute',
    bottom: spacing.m,
    right: spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg + 'DD',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: 12, fontWeight: '700' },

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
    zIndex: 10,
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
