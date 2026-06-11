import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useRecordingStore } from '@/store/recordingStore';
import { colors, radii, spacing, type } from '@/theme';

// Configure Google Sign-In with Web Client ID from Firebase Console.
GoogleSignin.configure({
  webClientId: '455854898290-2v4oj6nm2djplsk4td2kvs67knhp6ga6.apps.googleusercontent.com',
  iosClientId: '455854898290-al6qt69ku3o3p786f6dvhp5aq59skcb9.apps.googleusercontent.com',
});

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Sync local display name with firebase if creating account
  const localDisplayName = useRecordingStore((s) => s.displayName);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Update Firebase Auth profile
        const displayName = name.trim() || localDisplayName || 'Athlete';
        
        // Run profile updates in the background to make signup feel instantaneous
        Promise.all([
          updateProfile(cred.user, { displayName }),
          setDoc(doc(db, 'users', cred.user.uid), {
            displayName,
            createdAt: Date.now(),
            stats: {
              activities: 0,
              distanceM: 0,
              movingS: 0,
              elevationGainM: 0,
            },
          })
        ]).catch(err => console.error('Failed to initialize user profile:', err));
      }
      
      // On success, go back to profile or wherever they came from
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/profile');
      }
    } catch (error: any) {
      Alert.alert('Authentication Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      
      if (!idToken) {
        throw new Error('No ID token found.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      
      // Sync basic info if it's a new account or just to be safe
      const displayName = cred.user.displayName || 'Athlete';
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName,
        createdAt: cred.user.metadata.creationTime ? new Date(cred.user.metadata.creationTime).getTime() : Date.now(),
        // Only set stats if we want to initialize it. Using merge: true prevents overwriting existing users.
        stats: {
          activities: 0,
          distanceM: 0,
          movingS: 0,
          elevationGainM: 0,
        },
      }, { merge: true });

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/profile');
      }
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Failed', error.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={[type.title, { marginBottom: spacing.l }]}>
            {isLogin ? 'Welcome Back' : 'Join the Community'}
          </Text>

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.textDim}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={styles.btn}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.btnText}>
                {isLogin ? 'Log In' : 'Sign Up'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.switchBtn}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchBtnText}>
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          <Pressable 
            style={[styles.btn, styles.googleBtn]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-google" size={20} color="#000000" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.m,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.m,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.m,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    padding: spacing.m,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  btnText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
  },
  switchBtn: {
    marginTop: spacing.l,
    alignItems: 'center',
  },
  switchBtnText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    color: colors.textDim,
    marginHorizontal: spacing.m,
    fontSize: 12,
    fontWeight: '700',
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: radii.pill,
    padding: spacing.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
