import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Activity } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import { formatDistance, formatDuration, formatPace, distanceUnit, paceUnit, SPORT_COLOR, SPORT_LABEL } from '@/utils/format';

type ShareCardProps = {
  activity: Activity;
  units: 'km' | 'mi';
};

export default React.forwardRef<View, ShareCardProps>(function ShareCard({ activity, units }, ref) {
  const coords = activity.points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const sportColor = SPORT_COLOR[activity.sport] ?? colors.accent;

  const region =
    coords.length > 0
      ? fitRegion(coords)
      : { latitude: 0, longitude: 0, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View ref={ref} style={styles.cardContainer} collapsable={false}>
      {/* Background container to match IG post aspect ratio 4:5 */}
      <View style={styles.aspectRatioBox}>
        {/* Map as the background */}
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          userInterfaceStyle="dark"
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {coords.length > 1 && (
            <Polyline coordinates={coords} strokeColor={sportColor} strokeWidth={6} />
          )}
        </MapView>

        {/* Gradient / Overlay at the bottom */}
        <View style={styles.overlay}>
          {/* Top Info */}
          <View style={styles.header}>
            <View style={[styles.sportBadge, { borderColor: sportColor }]}>
              <Text style={[styles.sportBadgeText, { color: sportColor }]}>
                {SPORT_LABEL[activity.sport]}
              </Text>
            </View>
            <Text style={styles.brandText}>Athlr</Text>
          </View>

          {/* Bottom Stats */}
          <View style={styles.statsPanel}>
            <Text style={styles.titleText}>{activity.title}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Distance ({distanceUnit(units)})</Text>
                <Text style={[styles.statValue, { color: sportColor }]}>
                  {formatDistance(activity.distanceM, units)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Time</Text>
                <Text style={[styles.statValue, { color: sportColor }]}>
                  {formatDuration(activity.movingS)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Pace (/{paceUnit(units)})</Text>
                <Text style={[styles.statValue, { color: sportColor }]}>
                  {formatPace(activity.avgPaceSPerKm, units)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});

// Helpers
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
    // Add extra padding to MapView region for the image
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.005, (maxLng - minLng) * 1.6),
  };
}

const styles = StyleSheet.create({
  cardContainer: {
    // Hidden initially off-screen, but we need it mounted to screenshot
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 1080, // Render at high res
    backgroundColor: '#000',
  },
  aspectRatioBox: {
    width: 1080,
    height: 1350, // 4:5 aspect ratio
    backgroundColor: '#111',
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
  },
  sportBadge: {
    borderWidth: 3,
    borderRadius: 60,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sportBadgeText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  statsPanel: {
    backgroundColor: 'rgba(11, 18, 32, 0.85)',
    borderRadius: 40,
    padding: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titleText: {
    color: '#fff',
    fontSize: 60,
    fontWeight: '800',
    marginBottom: 40,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 54,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
