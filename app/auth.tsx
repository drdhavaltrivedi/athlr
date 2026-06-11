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
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useRecordingStore } from '@/store/recordingStore';
import { colors, radii, spacing, type } from '@/theme';

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

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
        await updateProfile(cred.user, { displayName });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName,
          createdAt: Date.now(),
          stats: {
            activities: 0,
            distanceM: 0,
            movingS: 0,
            elevationGainM: 0,
          },
        });
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

  return (
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
      </View>
    </KeyboardAvoidingView>
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
});
