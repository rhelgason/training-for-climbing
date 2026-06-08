/**
 * Persisted cloud-sync configuration (server URL + bearer token), stored
 * locally on the device. The URL may default from EXPO_PUBLIC_SYNC_URL.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tfc.syncConfig';

export interface SyncConfig {
  url: string;
  token: string;
  lastSyncedAt?: number;
}

export function defaultSyncUrl(): string {
  return process.env.EXPO_PUBLIC_SYNC_URL ?? '';
}

export function isSyncConfigured(config: SyncConfig | null): config is SyncConfig {
  return Boolean(config && config.url && config.token);
}

export async function getSyncConfig(): Promise<SyncConfig | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncConfig;
  } catch {
    return null;
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export async function clearSyncConfig(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
