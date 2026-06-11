import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, getUserActivities, followUser, unfollowUser, UserProfile } from '@/services/socialService';
import { ActivityCard } from '@/components/ActivityCard';
import { useRecordingStore } from '@/store/recordingStore';
import { colors, radii, spacing, type } from '@/theme';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const units = useRecordingStore(s => s.units);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    if (!id || typeof id !== 'string') return;
    const prof = await getUserProfile(id);
    if (prof) setProfile(prof);
    
    const acts = await getUserActivities(id, 20);
    setActivities(acts);
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    const isFollowing = profile.isFollowing;
    
    // Optimistic
    setProfile({ ...profile, isFollowing: !isFollowing });
    
    const success = isFollowing ? await unfollowUser(profile.uid) : await followUser(profile.uid);
    if (!success) {
      // Revert
      setProfile({ ...profile, isFollowing });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text style={type.body}>User not found.</Text>
      </View>
    );
  }

  // Calculate some lifetime stats from the recent 20 acts for display (if we don't have aggregated fields in Firestore)
  const totalActs = activities.length;
  const totalDist = activities.reduce((acc, a) => acc + (a.distanceM || 0), 0);
  const totalElev = activities.reduce((acc, a) => acc + (a.elevationGainM || 0), 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: profile.displayName }} />
      
      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.displayName[0]?.toUpperCase()}</Text>
            </View>
            <Text style={[type.h2, { marginBottom: 4 }]}>{profile.displayName}</Text>
            
            <Pressable
              style={[styles.followBtn, profile.isFollowing && styles.followingBtn]}
              onPress={handleFollowToggle}
            >
              <Text style={[styles.followBtnText, profile.isFollowing && styles.followingBtnText]}>
                {profile.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={type.h3}>{totalActs}</Text>
                <Text style={type.caption}>Recent Acts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={type.h3}>{(totalDist / 1000).toFixed(0)}</Text>
                <Text style={type.caption}>km Dist</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={type.h3}>{Math.round(totalElev)}</Text>
                <Text style={type.caption}>m Elev</Text>
              </View>
            </View>
            
            <Text style={[type.h3, { marginTop: spacing.xl, marginBottom: spacing.m }]}>Recent Activities</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            units={units}
            onPress={() => router.push(`/activity/${item.id}`)}
          />
        )}
        ListEmptyComponent={<Text style={type.caption}>No public activities yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.m,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: '700',
  },
  followBtn: {
    marginTop: spacing.m,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  followingBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 16,
  },
  followingBtnText: {
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.l,
  },
  statBox: {
    alignItems: 'center',
  },
});
