import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Challenge, ChallengeParticipant } from '@/types';
import { getChallenge, getChallengeLeaderboard, joinChallenge, getMyParticipantInfo, fallbackChallenges } from '@/services/challengeService';
import { withTimeout } from '@/utils/async';
import { auth } from '@/services/firebase';
import { notifySuccess } from '@/utils/haptics';
import { colors, radii, spacing, type } from '@/theme';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<ChallengeParticipant[]>([]);
  const [myInfo, setMyInfo] = useState<ChallengeParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadData = async () => {
    if (!id || typeof id !== 'string') return;
    // All three fetches in parallel, each bounded — the spinner can never run forever
    const [chalRes, lb, me] = await Promise.all([
      withTimeout(getChallenge(id), 8000).catch(() => null),
      withTimeout(getChallengeLeaderboard(id), 8000).catch(() => [] as ChallengeParticipant[]),
      withTimeout(getMyParticipantInfo(id), 8000).catch(() => null),
    ]);

    // Fall back to the bundled challenge if Firestore has no doc for this id
    const chal = chalRes ?? fallbackChallenges().find((c) => c.id === id) ?? null;

    setChallenge(chal);
    setLeaderboard(lb);
    setMyInfo(me);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleJoin = async () => {
    if (!challenge) return;
    if (!auth.currentUser) {
      Alert.alert(
        'Log in to join',
        'Join challenges, climb the leaderboard and track your progress with an Athlr account.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }
    setJoining(true);
    const success = await joinChallenge(challenge);
    if (success) {
      notifySuccess();
      Alert.alert('Joined!', 'You are now participating in this challenge. Your past qualifying activities have been counted.');
      await loadData();
    } else {
      Alert.alert(
        'Could not join',
        'Something went wrong while joining the challenge. Check your connection and try again.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Try again', onPress: handleJoin },
        ],
      );
    }
    setJoining(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text style={type.body}>Challenge not found.</Text>
      </View>
    );
  }

  const formatProgress = (val: number) => {
    if (challenge.type === 'distance') return `${(val / 1000).toFixed(1)}km`;
    if (challenge.type === 'elevation') return `${Math.round(val)}m`;
    return `${val}`;
  };

  const targetStr = formatProgress(challenge.targetValue);
  const myPct = myInfo ? Math.min(100, (myInfo.progressValue / challenge.targetValue) * 100) : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: challenge.title }} />
      
      <FlatList
        data={leaderboard}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heroBox}>
              <Ionicons name="trophy" size={48} color={colors.bg} style={{ marginBottom: spacing.m }} />
              <Text style={[type.h2, { color: colors.bg, textAlign: 'center' }]}>{challenge.title}</Text>
              <Text style={[type.body, { color: colors.bg, textAlign: 'center', opacity: 0.8, marginTop: 8 }]}>
                {challenge.description}
              </Text>
            </View>

            {myInfo ? (
              <View style={styles.myProgressBox}>
                <Text style={type.h3}>Your Progress</Text>
                <Text style={[type.caption, { marginBottom: spacing.m }]}>
                  {formatProgress(myInfo.progressValue)} / {targetStr} completed
                </Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${myPct}%` }]} />
                </View>
                {myPct >= 100 && (
                  <Text style={[type.caption, { color: colors.live, marginTop: spacing.s, textAlign: 'center' }]}>
                    Challenge Completed! 🎉
                  </Text>
                )}
              </View>
            ) : (
              <Pressable style={styles.joinBtn} onPress={handleJoin} disabled={joining}>
                {joining ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.joinBtnText}>Join Challenge</Text>}
              </Pressable>
            )}

            <Text style={[type.h3, { marginTop: spacing.xl, marginBottom: spacing.m }]}>Leaderboard</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = myInfo?.uid === item.uid;
          const pct = Math.min(100, (item.progressValue / challenge.targetValue) * 100);
          return (
            <Pressable 
              style={[styles.lbRow, isMe && { backgroundColor: colors.surfaceAlt }]}
              onPress={() => router.push(`/users/${item.uid}`)}
            >
              <Text style={[styles.lbRank, index < 3 && { color: colors.accent }]}>{index + 1}</Text>
              <View style={styles.lbInfo}>
                <Text style={type.body}>{item.displayName}</Text>
                <View style={styles.lbBarBg}>
                  <View style={[styles.lbBarFill, { width: `${pct}%`, backgroundColor: index < 3 ? colors.accent : colors.live }]} />
                </View>
              </View>
              <Text style={[type.h3, { width: 80, textAlign: 'right' }]}>{formatProgress(item.progressValue)}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={[type.caption, { textAlign: 'center' }]}>No participants yet. Be the first!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.l,
  },
  header: {
    marginBottom: spacing.l,
  },
  heroBox: {
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  joinBtnText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 16,
  },
  myProgressBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.l,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lbRank: {
    ...type.h3,
    width: 30,
    color: colors.textDim,
  },
  lbInfo: {
    flex: 1,
    paddingRight: spacing.m,
  },
  lbBarBg: {
    height: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  lbBarFill: {
    height: '100%',
  },
});
