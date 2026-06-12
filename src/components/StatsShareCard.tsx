import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline as SvgPolyline, Circle } from 'react-native-svg';
import { Activity } from '@/types';
import { colors, spacing } from '@/theme';
import {
  formatDistance,
  formatDuration,
  formatPace,
  distanceUnit,
  paceUnit,
  SPORT_COLOR,
  SPORT_LABEL,
  SPORT_ICON,
} from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';

// Card dimensions — rendered off-screen at 3× density for crisp PNG export
const W = 1080;
const H = 1080; // square — works on IG / Stories crop

type Props = { activity: Activity; units: 'km' | 'mi' };

export default React.forwardRef<View, Props>(function StatsShareCard(
  { activity, units },
  ref,
) {
  const sportColor = SPORT_COLOR[activity.sport] ?? colors.accent;
  const points = activity.points;
  const hasRoute = points.length > 1;

  // Normalise GPS coords → SVG viewport (800 × 420 px in card space)
  const routePoints = hasRoute ? normalise(points, 800, 380) : [];
  const routeStr = routePoints.map((p) => `${p.x},${p.y}`).join(' ');

  const dist = formatDistance(activity.distanceM, units);
  const time = formatDuration(activity.movingS);
  const pace = formatPace(activity.avgPaceSPerKm, units);
  const elev = `${Math.round(activity.elevationGainM)}m`;

  return (
    <View ref={ref} style={styles.wrapper} collapsable={false}>
      <View style={styles.card}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={[styles.sportPill, { backgroundColor: sportColor + '18', borderColor: sportColor + '55' }]}>
            <Text style={[styles.sportText, { color: sportColor }]}>
              {SPORT_LABEL[activity.sport] ?? activity.sport}
            </Text>
          </View>
          <Text style={styles.brand}>Athlr</Text>
        </View>

        {/* Route trace or sport icon */}
        <View style={styles.routeBox}>
          {hasRoute ? (
            <Svg width="100%" height="100%" viewBox="0 0 800 380">
              {/* Subtle shadow line */}
              <SvgPolyline
                points={routeStr}
                fill="none"
                stroke={sportColor + '28'}
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main route */}
              <SvgPolyline
                points={routeStr}
                fill="none"
                stroke={sportColor}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Start dot */}
              {routePoints.length > 0 && (
                <Circle
                  cx={routePoints[0].x}
                  cy={routePoints[0].y}
                  r={10}
                  fill="#fff"
                  stroke={sportColor}
                  strokeWidth={4}
                />
              )}
              {/* End dot */}
              {routePoints.length > 1 && (
                <Circle
                  cx={routePoints[routePoints.length - 1].x}
                  cy={routePoints[routePoints.length - 1].y}
                  r={10}
                  fill={sportColor}
                  stroke="#fff"
                  strokeWidth={4}
                />
              )}
            </Svg>
          ) : (
            <View style={[styles.noRoutePlaceholder, { borderColor: sportColor + '33' }]}>
              <Ionicons name={SPORT_ICON[activity.sport] as never} size={80} color={sportColor + '55'} />
            </View>
          )}
        </View>

        {/* Activity title */}
        <Text style={styles.title} numberOfLines={1}>{activity.title}</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBlock label={`Distance · ${distanceUnit(units)}`} value={dist} color={sportColor} large />
          <StatBlock label="Moving Time" value={time} color={sportColor} large />
          <StatBlock label={`Pace · ${paceUnit(units)}`} value={pace} color={sportColor} />
          <StatBlock label="Elevation · m" value={elev} color={sportColor} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={[styles.footerLine, { backgroundColor: sportColor }]} />
          <Text style={styles.footerText}>Track your journey on Athlr</Text>
        </View>
      </View>
    </View>
  );
});

function StatBlock({
  label, value, color, large,
}: {
  label: string; value: string; color: string; large?: boolean;
}) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, large && styles.statValueLarge, { color }]}>{value}</Text>
    </View>
  );
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function normalise(
  points: { latitude: number; longitude: number }[],
  svgW: number,
  svgH: number,
  pad = 30,
): { x: number; y: number }[] {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rangeX = maxLng - minLng || 1e-5;
  const rangeY = maxLat - minLat || 1e-5;
  const drawW = svgW - pad * 2;
  const drawH = svgH - pad * 2;
  // Preserve aspect ratio
  const scale = Math.min(drawW / rangeX, drawH / rangeY);
  const offsetX = (svgW - rangeX * scale) / 2;
  const offsetY = (svgH - rangeY * scale) / 2;
  return points.map((p) => ({
    x: offsetX + (p.longitude - minLng) * scale,
    // Flip Y: latitude increases northward, SVG y increases downward
    y: svgH - offsetY - (p.latitude - minLat) * scale,
  }));
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: W,
    backgroundColor: 'transparent',
  },
  card: {
    width: W,
    height: H,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 80,
    paddingVertical: 70,
    justifyContent: 'space-between',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportPill: {
    borderWidth: 2,
    borderRadius: 60,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  sportText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  brand: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#0B1220',
    letterSpacing: -2,
  },

  routeBox: {
    height: 380,
    width: '100%',
  },
  noRoutePlaceholder: {
    flex: 1,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 54,
    fontWeight: '800',
    color: '#0B1220',
    letterSpacing: -1,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  statBlock: {
    width: '50%',
    paddingBottom: 36,
  },
  statLabel: {
    fontSize: 26,
    fontWeight: '600',
    color: '#8A97AD',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 60,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  statValueLarge: {
    fontSize: 72,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  footerLine: {
    width: 6,
    height: 30,
    borderRadius: 3,
  },
  footerText: {
    fontSize: 28,
    color: '#8A97AD',
    fontWeight: '600',
  },
});
