import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
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
import { sendEmailVerification, signOut } from 'firebase/auth';
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

  const name = profile?.displayName || user?.displayName || displayName;
  const photoURL = profile?.photoURL || user?.photoURL;
  const initials = name
    ? name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const onSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Pressable
          style={styles.avatarRing}
          onPress={() => router.push(user ? '/users/edit' : '/auth')}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </Pressable>

        {user ? (
          <>
            <Text style={styles.heroName}>{name || 'Athlete'}</Text>
            <Text style={type.caption}>
              {profile?.username ? `@${profile.username}` : user.email}
            </Text>
            {profile?.bio ? (
              <Text style={styles.heroBio}>{profile.bio}</Text>
            ) : null}

            <View style={styles.heroActions}>
              <Pressable style={styles.editBtn} onPress={() => router.push('/users/edit')}>
                <Ionicons name="pencil" size={14} color={colors.accent} />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </Pressable>
              <Pressable style={styles.signOutBtn} onPress={onSignOut}>
                <Ionicons name="log-out-outline" size={14} color={colors.textDim} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroName}>{name || 'Welcome to Athlr'}</Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              Sign in to join challenges, follow athletes{'\n'}and back up your profile.
            </Text>
            <Pressable style={styles.loginBtn} onPress={() => router.push('/auth')}>
              <Text style={styles.loginBtnText}>Log In or Sign Up</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.m, gap: spacing.m }}>
        {/* ─── Email verification nudge ───────────────────────────────────── */}
        {user && !user.emailVerified && <VerifyEmailBanner />}

        {/* ─── All-time stats — distance is the hero ─────────────────────── */}
        <View style={styles.card}>
          <Text style={type.label}>All Time</Text>

          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>
              {formatDistance(stats.distanceM, units, 1)}
            </Text>
            <Text style={type.label}>{`Distance · ${distanceUnit(units)}`}</Text>
          </View>

          <View style={styles.statRow}>
            <MiniStat icon="flame" label="Activities" value={String(stats.count)} />
            <View style={styles.statDivider} />
            <MiniStat icon="time" label="Moving Time" value={formatDuration(stats.movingS)} />
            <View style={styles.statDivider} />
            <MiniStat icon="trending-up" label="Elev · m" value={String(Math.round(stats.elevationGainM))} />
          </View>
        </View>

        {/* ─── Connect Health ─────────────────────────────────────────────── */}
        <Pressable style={[styles.card, styles.healthCard]} onPress={() => router.push('/sync')}>
          <View style={styles.healthIconWrap}>
            <Ionicons name="heart" size={20} color="#FF2D55" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Connect Health Data</Text>
            <Text style={type.caption}>Apple Health, Google Fit, Garmin & more</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>

        {/* ─── Preferences ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={type.label}>Preferences</Text>

          <SettingRow
            icon="speedometer"
            iconColor={colors.accent}
            title="Units"
            right={
              <View style={styles.segment}>
                <SegmentButton label="km" value="km" current={units} onPress={setUnits} />
                <SegmentButton label="mi" value="mi" current={units} onPress={setUnits} />
              </View>
            }
          />

          <View style={styles.rowDivider} />

          <SettingRow
            icon="pause-circle"
            iconColor={colors.live}
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

        {/* ─── Privacy promise ────────────────────────────────────────────── */}
        <View style={[styles.card, styles.promiseCard]}>
          <View style={styles.promiseHeader}>
            <Ionicons name="shield-checkmark" size={16} color={colors.live} />
            <Text style={[type.label, { color: colors.live }]}>Our promise</Text>
          </View>
          <Text style={[type.caption, { lineHeight: 19 }]}>
            Activities are private by default. Your data stays on this device
            until you choose to share it — export everything as GPX any time,
            free, forever.
          </Text>
        </View>

        {/* ─── App version ────────────────────────────────────────────────── */}
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Athlr v0.1.0 · Built with ❤️
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerifyEmailBanner() {
  const [sent, setSent] = useState(false);
  const [, forceRender] = useState(0);

  const onResend = async () => {
    const u = auth.currentUser;
    if (!u) return;
    try {
      await sendEmailVerification(u);
      setSent(true);
    } catch {
      Alert.alert('Could not send', 'Please try again in a few minutes.');
    }
  };

  const onCheck = async () => {
    await auth.currentUser?.reload().catch(() => {});
    forceRender((n) => n + 1);
    if (!auth.currentUser?.emailVerified) {
      Alert.alert('Not verified yet', 'Tap the link in the email we sent you, then check again.');
    }
  };

  if (auth.currentUser?.emailVerified) return null;

  return (
    <View style={styles.verifyBanner}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
        <Ionicons name="mail-unread" size={18} color={colors.accent} />
        <Text style={[type.body, { flex: 1 }]}>
          {sent ? 'Verification email sent — check your inbox.' : 'Please verify your email address.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s }}>
        <Pressable style={styles.verifyBtn} onPress={onResend} accessibilityRole="button" accessibilityLabel="Resend verification email">
          <Text style={styles.verifyBtnText}>{sent ? 'Send again' : 'Resend email'}</Text>
        </Pressable>
        <Pressable style={styles.verifyBtn} onPress={onCheck} accessibilityRole="button" accessibilityLabel="Check verification status">
          <Text style={styles.verifyBtnText}>I&apos;ve verified</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon as never} size={14} color={colors.accent} />
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({
  label, value, current, onPress,
}: {
  label: string; value: Units; current: Units; onPress: (v: Units) => void;
}) {
  const active = value === current;
  return (
    <Pressable
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SettingRow({
  icon, iconColor, title, subtitle, right,
}: {
  icon: string; iconColor: string; title: string; subtitle?: string; right: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon as never} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: {
    alignItems: 'center',
    paddingTop: spacing.l,
    paddingBottom: spacing.l,
    paddingHorizontal: spacing.l,
    gap: spacing.xs,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.accent,
    padding: 3,
    marginBottom: spacing.s,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accent + '26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '800',
  },
  heroName: {
    ...type.h2,
    marginTop: spacing.xs,
  },
  heroBio: {
    ...type.caption,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.s,
    marginTop: spacing.m,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '1A',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
  },
  editBtnText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
  },
  signOutText: {
    color: colors.textDim,
    fontWeight: '600',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    borderRadius: radii.pill,
    marginTop: spacing.m,
  },
  loginBtnText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.m,
  },

  heroStat: { alignItems: 'center', gap: 2 },
  heroStatValue: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.m,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  miniStat: { flex: 1, alignItems: 'center', gap: 3 },
  miniStatValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textDim,
  },

  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderColor: '#FF2D5544',
    backgroundColor: '#FF2D5508',
  },
  healthIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF2D5522',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 32 + spacing.m,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    paddingHorizontal: spacing.m,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
  },
  segmentTextActive: {
    color: colors.bg,
  },

  promiseCard: {
    gap: spacing.s,
    borderColor: colors.live + '33',
  },
  verifyBanner: {
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '55',
    borderRadius: radii.card,
    padding: spacing.m,
  },
  verifyBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  verifyBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  promiseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});
