import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { lifetimeStats, LifetimeStats } from '@/db/database';
import { useRecordingStore } from '@/store/recordingStore';
import { useAuthStore } from '@/store/authStore';
import { auth } from '@/services/firebase';
import { signOut } from 'firebase/auth';
import { getUserProfile, UserProfile } from '@/services/socialService';
import { colors, radii, spacing, type } from '@/theme';
import { formatDistance, formatDuration, distanceUnit } from '@/utils/format';
import { Units } from '@/types';

export default function ProfileScreen() {
  const [stats, setStats] = useState<LifetimeStats>({
    count: 0,
    distanceM: 0,
    movingS: 0,
    elevationGainM: 0,
  });

  const router = useRouter();
  const autoPause = useRecordingStore((s) => s.autoPause);
  const setAutoPause = useRecordingStore((s) => s.setAutoPause);
  const units = useRecordingStore((s) => s.units);
  const setUnits = useRecordingStore((s) => s.setUnits);
  const displayName = useRecordingStore((s) => s.displayName);
  const setDisplayName = useRecordingStore((s) => s.setDisplayName);

  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      lifetimeStats().then(setStats).catch(console.warn);
      if (user) {
        getUserProfile(user.uid).then(setProfile).catch(console.warn);
      }
    }, [user]),
  );

  const initials = profile?.displayName || user?.displayName || displayName
    ? (profile?.displayName || user?.displayName || displayName)!.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}
    >
      {/* Avatar + name card */}
      <View style={styles.profileCard}>
        <Pressable style={styles.avatar} onPress={user ? () => router.push('/users/edit') : () => router.push('/auth')}>
          {profile?.photoURL || user?.photoURL ? (
             <View style={[StyleSheet.absoluteFill, { borderRadius: 32, overflow: 'hidden' }]}>
               <View style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceAlt }}>
                 <Ionicons name="person" size={24} color={colors.textDim} style={{ position: 'absolute', top: 20, left: 20 }} />
                 <Text style={{ position: 'absolute', opacity: 0 }}>{profile?.photoURL || user?.photoURL}</Text>
               </View>
             </View>
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={user ? undefined : () => router.push('/auth')}>
            <Text style={type.title}>
              {profile?.displayName || user?.displayName || displayName || 'Tap to sign in'}
            </Text>
            <Text style={type.caption}>
              {profile?.username ? `@${profile.username}` : (user?.email || 'Athlr athlete')}
            </Text>
            {profile?.bio ? (
              <Text style={[type.body, { marginTop: spacing.xs, color: colors.textDim }]}>{profile.bio}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      {user && (
        <View style={styles.actionRow}>
          <Pressable style={styles.editBtn} onPress={() => router.push('/users/edit')}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
          <Pressable onPress={() => signOut(auth)} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.textDim} />
          </Pressable>
        </View>
      )}

      {!user && (
        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/auth')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>Log In</Text>
          </Pressable>
        </View>
      )}

      {/* Lifetime stats */}
      <View style={styles.card}>
        <Text style={type.label}>All Time</Text>
        <View style={styles.grid}>
          <BigStat label="Activities" value={String(stats.count)} />
          <BigStat label={`Distance · ${distanceUnit(units)}`} value={formatDistance(stats.distanceM, units, 1)} />
          <BigStat label="Moving Time" value={formatDuration(stats.movingS)} />
          <BigStat label="Elevation · m" value={String(Math.round(stats.elevationGainM))} />
        </View>
      </View>

      {/* Connect Health */}
      <Pressable style={[styles.card, styles.healthCard]} onPress={() => router.push('/sync')}>
        <View style={styles.healthIconWrap}>
          <Ionicons name="heart-circle" size={24} color="#FF2D55" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>Connect Health Data</Text>
          <Text style={type.caption}>Import from Apple Health, Google Fit, Apple Watch, Garmin &amp; more</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      </Pressable>

      {/* Units preference */}
      <View style={styles.card}>
        <Text style={type.label}>Units</Text>
        <View style={styles.unitsRow}>
          <UnitButton label="Kilometres" value="km" current={units} onPress={setUnits} />
          <UnitButton label="Miles" value="mi" current={units} onPress={setUnits} />
        </View>
      </View>

      {/* Recording settings */}
      <View style={styles.card}>
        <Text style={type.label}>Recording</Text>

        <SettingRow
          title="Auto-pause"
          subtitle="Pause the clock when you stop moving"
          right={
            <Switch
              value={autoPause}
              onValueChange={setAutoPause}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor={colors.text}
            />
          }
        />
      </View>

      {/* Privacy promise */}
      <View style={styles.card}>
        <View style={styles.promiseHeader}>
          <Ionicons name="shield-checkmark" size={18} color={colors.live} />
          <Text style={[type.label, { color: colors.live }]}>Our promise</Text>
        </View>
        <Text style={[type.body, { marginTop: spacing.s }]}>
          Activities are private by default. Your data stays on this device
          until you choose to share it, and you can export everything as GPX
          any time — free, forever.
        </Text>
      </View>

      {/* App version */}
      <Text style={[type.caption, { textAlign: 'center', paddingBottom: spacing.m }]}>
        Athlr v0.1.0 · Built with ❤️
      </Text>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.bigValue}>{value}</Text>
    </View>
  );
}

function UnitButton({
  label, value, current, onPress,
}: {
  label: string; value: Units; current: Units; onPress: (v: Units) => void;
}) {
  const active = value === current;
  return (
    <Pressable
      style={[styles.unitBtn, active && styles.unitBtnActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.unitBtnText, active && styles.unitBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SettingRow({
  title, subtitle, right,
}: {
  title: string; subtitle: string; right: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{title}</Text>
        <Text style={type.caption}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent + '33',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
  },
  editBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    padding: spacing.s,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.m,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', marginBottom: spacing.m },
  bigValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },

  unitsRow: { flexDirection: 'row', gap: spacing.m },
  unitBtn: {
    flex: 1,
    paddingVertical: spacing.m,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  unitBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '22',
  },
  unitBtnText: { color: colors.textDim, fontWeight: '700' },
  unitBtnTextActive: { color: colors.accent },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  promiseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },

  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#FF2D5544',
    backgroundColor: '#FF2D5508',
  },
  healthIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF2D5522',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.s,
  },
});
