/**
 * Sync configuration — now derived from the signed-in account session. Kept as a
 * thin `{ url, token }` adapter so the sync engine and AI coach don't need to know
 * about accounts; they just ask for the current sync config.
 */
import { getSession, isSignedIn } from '../auth/session';

export interface SyncConfig {
  url: string;
  token: string;
  lastSyncedAt?: number;
}

/** The default server URL, baked into the build so users never type it. */
export function defaultSyncUrl(): string {
  return process.env.EXPO_PUBLIC_SYNC_URL ?? '';
}

export function isSyncConfigured(config: SyncConfig | null): config is SyncConfig {
  return Boolean(config && config.url && config.token);
}

/** The current sync config from the signed-in session, or null if signed out. */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  const session = await getSession();
  if (!isSignedIn(session)) return null;
  return { url: session.url, token: session.token, lastSyncedAt: session.lastSyncedAt };
}
