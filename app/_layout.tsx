import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { syncPendingActivities } from '@/services/cloudSyncService';
import { colors } from '@/theme';
// Must be imported at root so TaskManager.defineTask runs at every app start,
// including background wakeups triggered by the location task.
import '@/services/locationService';

export default function RootLayout() {
  useEffect(() => {
    // Sync on app startup / foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncPendingActivities();
      }
    });
    
    // Sync when user logs in
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        syncPendingActivities();
      }
    });

    return () => {
      sub.remove();
      unsubAuth();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="activity/[id]" options={{ title: 'Activity' }} />
        <Stack.Screen
          name="sync"
          options={{
            title: 'Connect Health',
            presentation: 'modal',
          }}
        />
        <Stack.Screen 
          name="users/search" 
          options={{ 
            title: 'Find Friends', 
            presentation: 'modal' 
          }} 
        />
        <Stack.Screen 
          name="users/edit" 
          options={{ 
            presentation: 'modal',
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="users/[id]" 
          options={{ 
            title: 'Profile' 
          }} 
        />
        <Stack.Screen 
          name="segment/[id]" 
          options={{ 
            title: 'Segment' 
          }} 
        />
        <Stack.Screen 
          name="segment/create/[activityId]" 
          options={{ 
            title: 'Create Segment',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="challenge/[id]" 
          options={{ 
            title: 'Challenge' 
          }} 
        />
      </Stack>
    </>
  );
}
