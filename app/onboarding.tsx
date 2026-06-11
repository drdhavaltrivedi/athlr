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
import { updateUserProfile, checkUsernameUnique, UserProfile } from '@/services/socialService';
import { colors, radii, spacing, type } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/9.x/avataaars/png?seed=Felix',
  'https://api.dicebear.com/9.x/avataaars/png?seed=Aneka',
  'https://api.dicebear.com/9.x/avataaars/png?seed=Oliver',
  'https://api.dicebear.com/9.x/avataaars/png?seed=Mia',
  'https://api.dicebear.com/9.x/avataaars/png?seed=Jack',
  'https://api.dicebear.com/9.x/avataaars/png?seed=Jude',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [saving, setSaving] = useState(false);
  
  // Form state
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(DEFAULT_AVATARS[0]);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
    }
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
      setPhotoURL(null); // Clear predefined selection
    }
  };

  const handleSelectPredefined = (url: string) => {
    setPhotoURL(url);
    setLocalImageUri(null); // Clear custom selection
  };

  const handleFinish = async () => {
    if (!user) return;
    
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      Alert.alert('Required', 'Please enter a username to continue.');
      return;
    }

    setSaving(true);
    let finalPhotoURL = photoURL;

    try {
      // 1. Upload new image if custom image was selected
      if (localImageUri) {
        const response = await fetch(localImageUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, blob);
        finalPhotoURL = await getDownloadURL(storageRef);
      }

      // 2. Check username uniqueness (null = couldn't verify due to network)
      const isUnique = await checkUsernameUnique(cleanUsername, user.uid);
      if (isUnique === false) {
        Alert.alert('Taken', 'That username is already taken. Please try another one.');
        setSaving(false);
        return;
      }
      if (isUnique === null) {
        Alert.alert('Connection problem', 'Could not verify the username. Please check your internet and try again.');
        setSaving(false);
        return;
      }

      // 3. Update auth profile (for Firebase auth compatibility)
      await updateProfile(user, {
        photoURL: finalPhotoURL,
      });

      // 4. Update Firestore user document
      await updateUserProfile(user.uid, {
        username: cleanUsername,
        photoURL: finalPhotoURL || null,
      });

      // 5. Navigate to app
      router.replace('/(tabs)/profile');
    } catch (err) {
      console.error('Onboarding error:', err);
      Alert.alert('Error', 'Failed to save profile setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[type.h2, { textAlign: 'center', marginTop: spacing.l }]}>Welcome to Athlr!</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.textDim, marginBottom: spacing.xl }]}>
            Let's get your profile set up.
          </Text>

          {/* Avatar Picker */}
          <Text style={type.label}>Choose an Avatar</Text>
          <View style={styles.avatarSection}>
            <View style={styles.avatarGrid}>
              <Pressable onPress={pickImage} style={[styles.avatarWrap, (!photoURL && localImageUri) && styles.selectedAvatar]}>
                {localImageUri ? (
                  <Image source={{ uri: localImageUri }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarImage, { backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="camera" size={32} color={colors.textDim} />
                  </View>
                )}
              </Pressable>
              
              {DEFAULT_AVATARS.map((url, idx) => (
                <Pressable 
                  key={idx} 
                  onPress={() => handleSelectPredefined(url)}
                  style={[styles.avatarWrap, photoURL === url && styles.selectedAvatar]}
                >
                  <Image source={{ uri: url }} style={styles.avatarImage} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Username */}
          <View style={styles.formGroup}>
            <Text style={type.label}>Choose a Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. runner123"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[type.caption, { marginTop: 4 }]}>Only letters, numbers, and underscores.</Text>
          </View>
          
          <View style={{ flex: 1 }} />
          
          <Pressable onPress={handleFinish} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.saveBtnText}>Finish Setup</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.l,
    flexGrow: 1,
    gap: spacing.l,
  },
  avatarSection: {
    marginVertical: spacing.s,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    padding: 2,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAvatar: {
    borderColor: colors.accent,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
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
  saveBtn: {
    backgroundColor: colors.accent,
    padding: spacing.m,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
});
