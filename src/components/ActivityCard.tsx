import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '@/services/firebase';
import { ActivitySummary } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import { formatDate, formatTime, formatDistance, formatDuration, formatPace, distanceUnit, paceUnit, SPORT_ICON, SPORT_COLOR } from '@/utils/format';
import { toggleKudo } from '@/services/cloudSyncService';

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
  const router = useRouter();
  const sportColor = SPORT_COLOR[item.sport] ?? colors.accent;
  const [kudos, setKudos] = useState(item.kudosCount || 0);
  const [given, setGiven] = useState(!!item.givenByMe);

  // FlatList recycles cards — re-seed state when the underlying item changes
  React.useEffect(() => {
    setKudos(item.kudosCount || 0);
    setGiven(!!item.givenByMe);
  }, [item.id, item.kudosCount, item.givenByMe]);

  // Private activities exist only in local SQLite — there is no cloud doc
  // to kudo, so the kudo UI is hidden for them entirely.
  const canKudo = item.visibility !== 'private';

  const handleKudo = async (e: any) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      Alert.alert(
        'Log in to give kudos',
        'Cheer on other athletes with an Athlr account.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }
    // Optimistic toggle; revert only if the write actually failed
    const newGiven = !given;
    setGiven(newGiven);
    setKudos((k: number) => (newGiven ? k + 1 : Math.max(0, k - 1)));
    const result = await toggleKudo(item.id);
    if (result === 'error') {
      setGiven(!newGiven);
      setKudos((k: number) => (!newGiven ? k + 1 : Math.max(0, k - 1)));
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

      {/* Kudos Footer — only for activities that exist in the cloud */}
      {canKudo && (
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
      )}
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
    borderRadius: radii.card,
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
