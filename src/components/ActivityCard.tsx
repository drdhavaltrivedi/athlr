import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivitySummary } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import { formatDate, formatTime, formatDistance, formatDuration, formatPace, distanceUnit, paceUnit } from '@/utils/format';
import { toggleKudo } from '@/services/cloudSyncService';

const SPORT_ICON: Record<string, string> = {
  running: 'walk',
  cycling: 'bicycle',
  hiking: 'trail-sign',
  all: 'fitness',
};

const SPORT_COLOR: Record<string, string> = {
  running: colors.accent,
  cycling: '#00D1FF',
  hiking: '#00E676',
  all: colors.textDim,
};

export function ActivityCard({
  item,
  units,
  onPress,
  onUserPress,
}: {
  item: ActivitySummary;
  units: 'km' | 'mi';
  onPress: () => void;
  onUserPress?: (uid: string) => void;
}) {
  const sportColor = SPORT_COLOR[item.sport] ?? colors.accent;
  const [kudos, setKudos] = useState(item.kudosCount || 0);
  const [given, setGiven] = useState(false);

  const handleKudo = async (e: any) => {
    e.stopPropagation();
    const newGiven = !given;
    setGiven(newGiven);
    setKudos((k: number) => newGiven ? k + 1 : k - 1);
    const success = await toggleKudo(item.id);
    if (!success) {
      setGiven(!newGiven);
      setKudos((k: number) => !newGiven ? k + 1 : k - 1);
    }
  };

  return (
    <Pressable style={[styles.card, { borderLeftColor: sportColor, borderLeftWidth: 3 }]} onPress={onPress}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: sportColor + '22' }]}>
          <Ionicons name={SPORT_ICON[item.sport] as never} size={18} color={sportColor} />
        </View>
        <View style={{ flex: 1 }}>
          {item.userName && (
            <Pressable onPress={() => onUserPress && item.uid ? onUserPress(item.uid) : null}>
              <Text style={[type.caption, { color: sportColor, fontWeight: '600', marginBottom: 2 }]}>
                {item.userName}
              </Text>
            </Pressable>
          )}
          <Text style={type.title} numberOfLines={1}>{item.title}</Text>
          <Text style={type.caption}>
            {formatDate(item.startedAt)} · {formatTime(item.startedAt)}
          </Text>
        </View>
        {item.visibility === 'private' && (
          <Ionicons name="lock-closed" size={14} color={colors.textDim} />
        )}
      </View>

      {/* Map Thumbnail */}
      {!!item.mapUrl && (
        <View style={styles.mapWrap}>
          <Image source={{ uri: item.mapUrl }} style={styles.mapThumb} />
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCell label={`Distance · ${distanceUnit(units)}`} value={formatDistance(item.distanceM, units)} />
        <StatCell label="Moving Time" value={formatDuration(item.movingS)} />
        <StatCell label={`Pace · ${paceUnit(units)}`} value={formatPace(item.avgPaceSPerKm, units)} />
        <StatCell label="Elev · m" value={String(Math.round(item.elevationGainM))} />
      </View>

      {/* Kudos Footer */}
      <View style={styles.cardFooter}>
        <Pressable style={styles.kudoBtn} onPress={handleKudo}>
          <Ionicons 
            name={given ? "heart" : "heart-outline"} 
            size={20} 
            color={given ? colors.accent : colors.textDim} 
          />
          <Text style={[styles.kudoText, given && { color: colors.accent }]}>
            {kudos} {kudos === 1 ? 'Kudo' : 'Kudos'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.h3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    marginBottom: spacing.l,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.l,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.m,
  },
  mapWrap: {
    height: 160,
    backgroundColor: colors.surfaceAlt,
  },
  mapThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  statCell: {
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
  },
  kudoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.s,
    paddingRight: spacing.m,
  },
  kudoText: {
    ...type.body,
    marginLeft: spacing.xs,
    color: colors.textDim,
  },
});
