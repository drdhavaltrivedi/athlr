import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Challenge } from '@/types';
import { getActiveChallenges, seedSampleChallenges, fallbackChallenges } from '@/services/challengeService';
import { searchUsers, getFollowingIds } from '@/services/socialService';
import type { UserProfile } from '@/services/socialService';
import { withTimeout } from '@/utils/async';
import { useAuthStore } from '@/store/authStore';
import { colors, radii, spacing, type } from '@/theme';

export default function FindScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const loadChallenges = useCallback(async () => {
    const [data, ids] = await Promise.all([
      withTimeout(getActiveChallenges(), 8000).catch(() => [] as Challenge[]),
      user ? getFollowingIds().catch(() => []) : Promise.resolve([]),
    ]);
    setChallenges(data.length > 0 ? data : fallbackChallenges());
    setFollowingIds(ids);
    if (data.length === 0) seedSampleChallenges().catch(() => {});
    setLoadingChallenges(false);
  }, [user]);

  useEffect(() => { loadChallenges(); }, [loadChallenges]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  };

  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    const results = await withTimeout(searchUsers(q.trim()), 6000).catch(() => []);
    setSearchResults(results);
    setSearchDone(true);
    setSearching(false);
  };

  const getTargetString = (chal: Challenge) => {
    if (chal.type === 'distance') return `${chal.targetValue / 1000}km`;
    if (chal.type === 'elevation') return `${chal.targetValue}m`;
    return `${chal.targetValue}`;
  };

  const isSearching = query.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search athletes by name or username…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={(q) => {
            setQuery(q);
            doSearch(q);
          }}
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setSearchResults([]); setSearchDone(false); }}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      {/* ── Search results panel ─────────────────────────────────── */}
      {isSearching && (
        <View style={styles.section}>
          {searching ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : searchDone && searchResults.length === 0 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="person-outline" size={40} color={colors.textDim} style={{ marginBottom: spacing.m }} />
              <Text style={styles.emptyTitle}>No athletes found</Text>
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.s }]}>
                Try a different name or username.{'\n'}Athletes must have a public profile to appear here.
              </Text>
            </View>
          ) : (
            searchResults.map((u) => (
              <UserRow
                key={u.uid}
                profile={u}
                isFollowing={followingIds.includes(u.uid)}
                isSelf={user?.uid === u.uid}
                onPress={() => router.push(`/users/${u.uid}`)}
              />
            ))
          )}
        </View>
      )}

      {/* ── Browse section (hidden while searching) ─────────────── */}
      {!isSearching && (
        <>
          {/* Find friends prompt when not logged in */}
          {!user && (
            <Pressable style={styles.loginBanner} onPress={() => router.push('/auth')}>
              <Ionicons name="people" size={24} color={colors.accent} style={{ marginRight: spacing.m }} />
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '700' }]}>Find your training crew</Text>
                <Text style={type.caption}>Log in to follow athletes and see their activities in your feed.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          )}

          {/* Challenges */}
          <Text style={styles.sectionTitle}>Active Challenges</Text>

          {loadingChallenges ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : challenges.length === 0 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="trophy-outline" size={40} color={colors.textDim} style={{ marginBottom: spacing.m }} />
              <Text style={styles.emptyTitle}>No active challenges</Text>
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.s }]}>
                Check back soon — new monthly challenges drop at the start of each month.
              </Text>
            </View>
          ) : (
            challenges.map((item) => (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/challenge/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="trophy" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>{item.title}</Text>
                    <Text style={type.caption}>
                      Ends {new Date(item.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                </View>
                <Text style={[type.body, { color: colors.textDim, marginTop: spacing.s }]} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.tags}>
                  <Tag icon="people" label={`${item.participantCount} joined`} />
                  <Tag icon="flag" label={`${getTargetString(item)} goal`} />
                </View>
              </Pressable>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserRow({
  profile, isFollowing, isSelf, onPress,
}: {
  profile: UserProfile;
  isFollowing: boolean;
  isSelf: boolean;
  onPress: () => void;
}) {
  const initials = (profile.displayName || profile.username || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Pressable style={styles.userRow} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{profile.displayName || 'Athlete'}</Text>
        {profile.username ? (
          <Text style={type.caption}>@{profile.username}</Text>
        ) : null}
      </View>
      {!isSelf && (
        <View style={[styles.followBadge, isFollowing && styles.followBadgeActive]}>
          <Text style={[styles.followBadgeText, isFollowing && { color: colors.accent }]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} style={{ marginLeft: spacing.s }} />
    </Pressable>
  );
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon as never} size={13} color={colors.textDim} />
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingBottom: spacing.xl * 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    marginBottom: spacing.l,
    height: 44,
  },
  searchIcon: { marginRight: spacing.s },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    height: '100%',
  },

  section: { marginBottom: spacing.l },
  sectionTitle: {
    ...type.h3,
    marginBottom: spacing.m,
  },

  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...type.h3,
    color: colors.textDim,
  },

  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: spacing.m,
    marginBottom: spacing.l,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent + '33',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  followBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 4,
  },
  followBadgeActive: {
    borderColor: colors.accent + '66',
    backgroundColor: colors.accent + '11',
  },
  followBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDim,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.l,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tags: {
    flexDirection: 'row',
    marginTop: spacing.m,
    gap: spacing.s,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
