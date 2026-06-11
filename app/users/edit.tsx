import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker native module not found');
}
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, storage } from '@/services/firebase';
import { getUserProfile, updateUserProfile, checkUsernameUnique, UserProfile } from '@/services/socialService';
import { colors, radii, spacing, type } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.back();
      return;
    }
    getUserProfile(user.uid).then(p => {
      if (p) {
        setProfile(p);
        setDisplayName(p.displayName || user.displayName || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
        setPhotoURL(p.photoURL || user.photoURL || null);
      } else {
        setDisplayName(user.displayName || '');
      }
      setLoading(false);
    });
  }, [user]);

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Not Supported', 'Image picking is not supported in this environment.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }

    setSaving(true);
    let finalPhotoURL = photoURL;

    try {
      // 1. Upload new image if selected
      if (localImageUri) {
        const response = await fetch(localImageUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, blob);
        finalPhotoURL = await getDownloadURL(storageRef);
      }

      // 2. Check username uniqueness
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername) {
        const isUnique = await checkUsernameUnique(cleanUsername, user.uid);
        if (!isUnique) {
          Alert.alert('Taken', 'That username is already taken.');
          setSaving(false);
          return;
        }
      }

      // 3. Update auth profile (for Firebase auth compatibility)
      await updateProfile(user, {
        displayName: displayName.trim(),
        photoURL: finalPhotoURL,
      });

      // 4. Update Firestore user document
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        photoURL: finalPhotoURL || undefined,
      });

      router.back();
    } catch (err) {
      console.error('Save profile error:', err);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Text style={type.h3}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Picker */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickImage} style={styles.avatarWrap}>
            {localImageUri || photoURL ? (
              <Image source={{ uri: localImageUri || photoURL! }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, { backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={40} color={colors.textDim} />
              </View>
            )}
            <View style={styles.editIconWrap}>
              <Ionicons name="camera" size={16} color={colors.bg} />
            </View>
          </Pressable>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={type.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="John Doe"
            placeholderTextColor={colors.textDim}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={type.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="johndoe123"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[type.caption, { marginTop: 4 }]}>Only letters, numbers, and underscores.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={type.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="A little bit about yourself..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            maxLength={160}
          />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { padding: spacing.xs },
  btnText: { color: colors.textDim, fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
  },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  content: {
    padding: spacing.l,
    gap: spacing.l,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing.m,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  formGroup: {
    gap: spacing.s,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.m,
    color: colors.text,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});
