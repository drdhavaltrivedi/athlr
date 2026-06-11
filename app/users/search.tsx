import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers, followUser, unfollowUser, UserProfile } from '@/services/socialService';
import { colors, radii, spacing, type } from '@/theme';

export default function UserSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setLoading(true);
        const results = await searchUsers(query);
        setUsers(results);
        setLoading(false);
      } else {
        setUsers([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleToggleFollow = async (user: UserProfile) => {
    const isFollowing = user.isFollowing;
    
    // Optimistic UI update
    setUsers(users.map(u => u.uid === user.uid ? { ...u, isFollowing: !isFollowing } : u));
    
    const success = isFollowing 
      ? await unfollowUser(user.uid)
      : await followUser(user.uid);
      
    if (!success) {
      // Revert on failure
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isFollowing } : u));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Find Friends', presentation: 'modal' }} />
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textDim} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor={colors.textDim}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item.uid}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.userRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.displayName[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={type.body}>{item.displayName}</Text>
                  {item.email && <Text style={type.caption}>{item.email}</Text>}
                </View>
                <Pressable
                  style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                  onPress={() => handleToggleFollow(item)}
                >
                  <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
                    {item.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              query.trim().length > 1 && !loading ? (
                <Text style={styles.emptyText}>No athletes found.</Text>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    margin: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: spacing.m,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.m,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  followBtn: {
    paddingHorizontal: spacing.m,
    paddingVertical: 8,
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
    fontSize: 14,
  },
  followingBtnText: {
    color: colors.text,
  },
  emptyText: {
    ...type.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
