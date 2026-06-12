import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, type } from '@/theme';
import * as mapCache from '@/services/mapCacheService';

export default function OfflineMapsScreen() {
  const [regions, setRegions] = useState<mapCache.MapRegion[]>([]);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<mapCache.DownloadProgress | null>(null);
  const [estimate, setEstimate] = useState<{ count: number; bytes: number } | null>(null);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    const r = await mapCache.getDownloadedRegions();
    setRegions(r);
  };

  const updateEstimate = async (region: Region) => {
    setCurrentRegion(region);
    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLon = region.longitude - region.longitudeDelta / 2;
    const maxLon = region.longitude + region.longitudeDelta / 2;
    
    // Hardcoded zoom 13-16 for decent balance
    const est = await mapCache.estimateTileCount(Math.min(minLat, maxLat), Math.max(minLat, maxLat), Math.min(minLon, maxLon), Math.max(minLon, maxLon), 13, 16);
    setEstimate({ count: est.count, bytes: est.estimatedBytes });
  };

  const handleDownload = async () => {
    if (!currentRegion || !estimate) return;
    if (estimate.count > 10000) {
      Alert.alert('Region too large', 'Please zoom in to select a smaller area. Downloading > 10,000 tiles takes too long.');
      return;
    }

    Alert.prompt(
      'Name this region',
      'Give this offline map a name (e.g. "Yosemite")',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: async (name) => {
            if (!name) return;
            setIsDownloading(true);
            setProgress({ total: estimate.count, downloaded: 0, bytes: 0 });

            const minLat = currentRegion.latitude - currentRegion.latitudeDelta / 2;
            const maxLat = currentRegion.latitude + currentRegion.latitudeDelta / 2;
            const minLon = currentRegion.longitude - currentRegion.longitudeDelta / 2;
            const maxLon = currentRegion.longitude + currentRegion.longitudeDelta / 2;

            try {
              await mapCache.downloadRegion(
                name,
                Math.min(minLat, maxLat), Math.max(minLat, maxLat), Math.min(minLon, maxLon), Math.max(minLon, maxLon),
                13, 16,
                (p) => setProgress(p)
              );
              Alert.alert('Success', `${name} downloaded successfully!`);
              await loadRegions();
            } catch (e) {
              Alert.alert('Error', 'Download failed.');
            } finally {
              setIsDownloading(false);
              setProgress(null);
            }
          }
        }
      ]
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Region?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await mapCache.deleteRegion(id);
        await loadRegions();
      }}
    ]);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Offline Maps' }} />

      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          onRegionChangeComplete={updateEstimate}
        />
        {/* Visual bounding box indicating the download area */}
        <View style={styles.reticle}>
          <View style={styles.reticleInner} />
        </View>
      </View>

      <View style={styles.panel}>
        {isDownloading ? (
          <View style={styles.downloadingWrap}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.downloadText}>
              Downloading {progress?.downloaded} / {progress?.total} tiles...
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((progress?.downloaded || 0) / (progress?.total || 1)) * 100}%` }
                ]} 
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.estimateRow}>
              <View>
                <Text style={type.label}>Current View</Text>
                <Text style={type.caption}>
                  {estimate ? `${estimate.count} tiles (~${formatBytes(estimate.bytes)})` : 'Calculating...'}
                </Text>
              </View>
              <Pressable 
                style={[styles.downloadBtn, (estimate?.count ?? 0) > 10000 && styles.downloadBtnDisabled]} 
                onPress={handleDownload}
              >
                <Ionicons name="cloud-download-outline" size={20} color={colors.surface} />
                <Text style={styles.downloadBtnText}>Download</Text>
              </Pressable>
            </View>
          </>
        )}
        
        <View style={styles.listHeader}>
          <Text style={type.h3}>Saved Regions</Text>
        </View>

        <FlatList
          data={regions}
          keyExtractor={r => r.id}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <View style={styles.regionCard}>
              <View style={styles.regionInfo}>
                <Text style={styles.regionName}>{item.name}</Text>
                <Text style={type.caption}>
                  {item.tileCount} tiles · {formatBytes(item.sizeBytes)}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[type.body, { textAlign: 'center', marginTop: spacing.l, color: colors.textDim }]}>
              No regions downloaded yet.
            </Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mapContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticle: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: radii.card,
    pointerEvents: 'none',
  },
  reticleInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderRadius: radii.card,
  },
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  downloadBtn: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.card,
    gap: spacing.xs,
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadBtnText: {
    color: colors.surface,
    fontWeight: 'bold',
  },
  downloadingWrap: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  downloadText: {
    color: colors.text,
    marginTop: spacing.s,
    marginBottom: spacing.m,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  listHeader: {
    padding: spacing.m,
    paddingBottom: spacing.xs,
  },
  regionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    ...type.body,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deleteBtn: {
    padding: spacing.s,
  },
});
