import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Challenge } from '@/types';
import { getActiveChallenges, seedSampleChallenges } from '@/services/challengeService';
import { colors, radii, spacing, type } from '@/theme';

export default function ChallengesScreen() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChallenges = async () => {
    let data = await getActiveChallenges();
    if (data.length === 0) {
      await seedSampleChallenges();
      data = await getActiveChallenges();
    }
    setChallenges(data);
    setLoading(false);
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  };

  const getTargetString = (chal: Challenge) => {
    if (chal.type === 'distance') return `${chal.targetValue / 1000}km`;
    if (chal.type === 'elevation') return `${chal.targetValue}m`;
    return `${chal.targetValue}`;
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListHeaderComponent={
            <Text style={[type.h2, { marginBottom: spacing.l }]}>Active Clubs & Challenges</Text>
          }
          renderItem={({ item }) => (
            <Pressable 
              style={styles.card}
              onPress={() => router.push(`/challenge/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name="trophy" size={24} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{item.title}</Text>
                  <Text style={type.caption}>{new Date(item.endDate).toLocaleDateString()} Deadline</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
              </View>
              
              <Text style={[type.body, { marginTop: spacing.m, color: colors.textDim }]}>
                {item.description}
              </Text>
              
              <View style={styles.footer}>
                <View style={styles.tag}>
                  <Ionicons name="people" size={14} color={colors.text} style={{ marginRight: 4 }} />
                  <Text style={type.caption}>{item.participantCount} joined</Text>
                </View>
                <View style={styles.tag}>
                  <Ionicons name="flag" size={14} color={colors.text} style={{ marginRight: 4 }} />
                  <Text style={type.caption}>{getTargetString(item)} Goal</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.l,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    padding: spacing.l,
    marginBottom: spacing.l,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
  },
  footer: {
    flexDirection: 'row',
    marginTop: spacing.l,
    gap: spacing.m,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: radii.s,
  },
});
