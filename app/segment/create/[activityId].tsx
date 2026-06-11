import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getActivity } from '@/db/database';
import { Activity, Segment } from '@/types';
import { colors, spacing, radii, type } from '@/theme';
import * as segmentService from '@/services/segmentService';
import { useAuthStore } from '@/store/authStore';

export default function CreateSegmentScreen() {
  const { activityId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadActivity();
  }, [activityId]);

  const loadActivity = async () => {
    const data = await getActivity(activityId as string);
    if (data && data.points.length > 2) {
      setActivity(data);
      setStartIndex(Math.floor(data.points.length * 0.25));
      setEndIndex(Math.floor(data.points.length * 0.75));
    } else {
      Alert.alert('Error', 'Activity not found or has no GPS data.');
      router.back();
    }
  };

  const handleSave = () => {
    if (!activity || !user) return;
    
    Alert.prompt('Name Segment', 'e.g., "Main St Sprint"', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Save', 
        onPress: async (name) => {
          if (!name) return;
          setSaving(true);
          
          const startPt = activity.points[startIndex];
          const endPt = activity.points[endIndex];
          
          // Calculate distance between indices
          let distanceM = 0;
          let elevationGainM = 0;
          for (let i = startIndex; i < endIndex - 1; i++) {
            const p1 = activity.points[i];
            const p2 = activity.points[i + 1];
            // Simple rough distance (better to use Haversine, but this is a placeholder)
            // Just use elapsed time roughly for MVP, or proper Haversine.
            // Since we need it fast, we can approximate or use a simple function.
            const R = 6371e3;
            const lat1 = (p1.latitude * Math.PI) / 180;
            const lat2 = (p2.latitude * Math.PI) / 180;
            const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
            const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceM += R * c;

            if (p2.altitude && p1.altitude && p2.altitude > p1.altitude) {
              elevationGainM += (p2.altitude - p1.altitude);
            }
          }

          const segmentPts = activity.points.slice(startIndex, endIndex + 1);
          const encodedPolyline = JSON.stringify(segmentPts.map(p => [p.latitude, p.longitude]));

          const segment: Segment = {
            id: Date.now().toString(),
            name,
            creatorId: user.uid,
            creatorName: user.displayName || 'Athlete',
            startPoint: { lat: startPt.latitude, lon: startPt.longitude },
            endPoint: { lat: endPt.latitude, lon: endPt.longitude },
            distanceMeters: Math.round(distanceM),
            elevationGainMeters: Math.round(elevationGainM),
            polyline: encodedPolyline,
            createdAt: Date.now(),
          };

          await segmentService.createSegment(segment);
          setSaving(false);
          Alert.alert('Success', 'Segment created!');
          router.back();
        }
      }
    ]);
  };

  if (!activity) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const segmentPoints = activity.points.slice(startIndex, endIndex + 1).map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));
  
  const allPoints = activity.points.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const startPt = activity.points[startIndex];
  const endPt = activity.points[endIndex];

  const shiftStart = (delta: number) => {
    let n = startIndex + delta;
    if (n < 0) n = 0;
    if (n >= endIndex - 5) n = endIndex - 5;
    setStartIndex(n);
  };

  const shiftEnd = (delta: number) => {
    let n = endIndex + delta;
    if (n > activity.points.length - 1) n = activity.points.length - 1;
    if (n <= startIndex + 5) n = startIndex + 5;
    setEndIndex(n);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Segment' }} />

      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: startPt.latitude,
            longitude: startPt.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          userInterfaceStyle="dark"
        >
          <Polyline coordinates={allPoints} strokeColor="rgba(255,255,255,0.3)" strokeWidth={3} />
          <Polyline coordinates={segmentPoints} strokeColor={colors.accent} strokeWidth={5} />
          
          <Marker coordinate={{ latitude: startPt.latitude, longitude: startPt.longitude }}>
            <View style={[styles.marker, { backgroundColor: colors.success }]} />
          </Marker>
          <Marker coordinate={{ latitude: endPt.latitude, longitude: endPt.longitude }}>
            <View style={[styles.marker, { backgroundColor: colors.danger }]} />
          </Marker>
        </MapView>
      </View>

      <View style={styles.controls}>
        <Text style={type.h3}>Adjust Endpoints</Text>
        
        <View style={styles.row}>
          <Text style={[type.label, { width: 60, color: colors.success }]}>Start</Text>
          <Pressable style={styles.btn} onPress={() => shiftStart(-10)}><Ionicons name="remove" size={20} color={colors.text}/></Pressable>
          <Pressable style={styles.btn} onPress={() => shiftStart(10)}><Ionicons name="add" size={20} color={colors.text}/></Pressable>
        </View>

        <View style={styles.row}>
          <Text style={[type.label, { width: 60, color: colors.danger }]}>End</Text>
          <Pressable style={styles.btn} onPress={() => shiftEnd(-10)}><Ionicons name="remove" size={20} color={colors.text}/></Pressable>
          <Pressable style={styles.btn} onPress={() => shiftEnd(10)}><Ionicons name="add" size={20} color={colors.text}/></Pressable>
        </View>

        <Pressable 
          style={[styles.saveBtn, saving && { opacity: 0.5 }]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create Segment'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapWrap: {
    flex: 1,
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  controls: {
    backgroundColor: colors.surface,
    padding: spacing.m,
    paddingBottom: spacing.xl,
    gap: spacing.m,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  btn: {
    backgroundColor: colors.border,
    padding: spacing.s,
    borderRadius: radii.s,
    width: 50,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    padding: spacing.m,
    borderRadius: radii.m,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
