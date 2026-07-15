/**
 * Sync configuration — a thin `{ url, token }` adapter so the sync engine and AI
 * coach don't need to know about accounts; they just receive the current config.
 *
 * This core version holds only the platform-neutral pieces. Each app derives a
 * `SyncConfig` from its own session store (mobile: AsyncStorage; web:
 * localStorage) and supplies the base URL for its environment.
 */
export interface SyncConfig {
  url: string;
  token: string;
  lastSyncedAt?: number;
}

export function isSyncConfigured(config: SyncConfig | null): config is SyncConfig {
  return Boolean(config && config.url && config.token);
}
