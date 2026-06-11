import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Segment, SegmentEffort } from '@/types';
import { colors, spacing, radii, type } from '@/theme';
import * as segmentService from '@/services/segmentService';
import { formatDuration } from '@/utils/format';

export default function SegmentScreen() {
  const { id } = useLocalSearchParams();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [leaderboard, setLeaderboard] = useState<SegmentEffort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const seg = await segmentService.getSegment(id as string);
      if (seg) {
        setSegment(seg);
        const efforts = await segmentService.getSegmentLeaderboard(seg.id);
        setLeaderboard(efforts);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!segment) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text style={type.body}>Segment not found.</Text>
      </View>
    );
  }

  let decodedPoints: {latitude: number, longitude: number}[] = [];
  try {
    const raw = JSON.parse(segment.polyline);
    decodedPoints = raw.map((p: number[]) => ({ latitude: p[0], longitude: p[1] }));
  } catch (e) {
    console.warn('Failed to parse polyline', e);
  }

  const renderEffort = ({ item, index }: { item: SegmentEffort, index: number }) => (
    <View style={styles.effortRow}>
      <Text style={styles.rank}>{index + 1}</Text>
      <View style={styles.effortInfo}>
        <Text style={type.body}>{item.userName}</Text>
        <Text style={type.caption}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>
      <Text style={[type.h3, { color: colors.accent }]}>
        {formatDuration(item.elapsedTimeS)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: segment.name }} />
      
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: segment.startPoint.lat,
            longitude: segment.startPoint.lon,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          userInterfaceStyle="dark"
          scrollEnabled={false}
          zoomEnabled={false}
        >
          {decodedPoints.length > 0 && (
            <Polyline coordinates={decodedPoints} strokeColor={colors.accent} strokeWidth={5} />
          )}
          <Marker coordinate={{ latitude: segment.startPoint.lat, longitude: segment.startPoint.lon }}>
            <View style={[styles.marker, { backgroundColor: colors.success }]} />
          </Marker>
          <Marker coordinate={{ latitude: segment.endPoint.lat, longitude: segment.endPoint.lon }}>
            <View style={[styles.marker, { backgroundColor: colors.danger }]} />
          </Marker>
        </MapView>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={type.h2}>{segment.name}</Text>
          <Text style={type.body}>
            {(segment.distanceMeters / 1000).toFixed(2)} km · {segment.elevationGainMeters} m
          </Text>
          <Text style={type.caption}>Created by {segment.creatorName}</Text>
        </View>

        <FlatList
          data={leaderboard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderEffort}
          ListHeaderComponent={
            <Text style={[type.h3, { marginBottom: spacing.m }]}>Leaderboard</Text>
          }
          ListEmptyComponent={
            <Text style={type.caption}>No efforts found. Be the first to try this segment!</Text>
          }
        />
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
    height: 250,
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.l,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    padding: spacing.l,
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rank: {
    ...type.h3,
    width: 30,
    color: colors.textDim,
  },
  effortInfo: {
    flex: 1,
  },
});
