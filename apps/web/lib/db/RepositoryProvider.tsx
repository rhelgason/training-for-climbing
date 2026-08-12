'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  HttpRemoteStore,
  isSessionExpired,
  log,
  now,
  registerEventSink,
  runSync,
  trackEvent,
  type Repository,
} from '@tfc/core';
import { WebRepository } from './webRepository';
import { API_BASE } from '../config';
import { clearSession, getSession, getSyncConfig, saveSession } from '../auth/session';

/** Debounce a push after local edits; cap the blocking initial pull. */
const PUSH_DEBOUNCE_MS = 1500;
const INITIAL_SYNC_TIMEOUT_MS = 6000;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'signed-out';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Bumps after every completed sync so screens can re-read fresh data. */
  dataVersion: number;
  /** Trigger a sync now (used by the indicator's retry + manual refresh). */
  refresh: () => void;
}

const RepositoryContext = createContext<Repository | null>(null);
const SyncContext = createContext<SyncState | null>(null);

/**
 * Creates and initialises the browser Repository once, wires usage events + auto
 * sync, and blocks rendering until the local store has hydrated (and, when signed
 * in, until an initial pull from the server completes so other devices' data
 * shows on load).
 *
 * Also exposes sync status (see useSync) for the status indicator and for screens
 * that want to re-read after a background pull (via `dataVersion`).
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => new WebRepository(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  // Latest refresh fn, so the context value can stay stable.
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    setLastSyncedAt(getSession()?.lastSyncedAt ?? null);

    let cancelled = false;
    let syncing = false;
    let dirtyDuringSync = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;

    const runOnce = async (): Promise<void> => {
      const cfg = getSyncConfig();
      if (!cfg) {
        if (!cancelled) setStatus('idle');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) setStatus('offline');
        return;
      }
      if (syncing) {
        dirtyDuringSync = true;
        return;
      }
      syncing = true;
      if (!cancelled) setStatus('syncing');
      try {
        await repo.flush();
        await runSync(repo, new HttpRemoteStore(API_BASE, cfg.token));
        const syncedAt = now();
        const s = getSession();
        if (s) saveSession({ ...s, lastSyncedAt: syncedAt });
        if (!cancelled) {
          setLastSyncedAt(syncedAt);
          setDataVersion((v) => v + 1);
          setStatus('idle');
        }
      } catch (err) {
        // An expired/invalidated token can't be retried into working, so drop
        // the session and ask for a fresh sign-in instead of looping on errors.
        // Local data is untouched — the app stays fully usable offline.
        if (isSessionExpired(err)) {
          log.warn('session expired during sync; signing out');
          clearSession();
          trackEvent('signed_out');
          if (!cancelled) {
            setLastSyncedAt(null);
            setStatus('signed-out');
          }
        } else {
          log.error('auto-sync failed', err);
          if (!cancelled) setStatus('error');
        }
      } finally {
        syncing = false;
        if (dirtyDuringSync && !cancelled) {
          dirtyDuringSync = false;
          scheduleSync();
        }
      }
    };

    const scheduleSync = () => {
      if (!getSyncConfig()) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void runOnce(), PUSH_DEBOUNCE_MS);
    };

    refreshRef.current = () => void runOnce();

    (async () => {
      try {
        await repo.init();
        registerEventSink((event) => {
          repo.recordEvent(event).catch((err) => log.error('failed to persist event', err));
        });
        if (getSyncConfig()) {
          await Promise.race([
            runOnce(),
            new Promise((resolve) => setTimeout(resolve, INITIAL_SYNC_TIMEOUT_MS)),
          ]);
        }
        if (!cancelled) {
          setReady(true);
          trackEvent('app_opened');
        }
      } catch (err) {
        log.error('repository init failed', err);
        if (!cancelled) setError(err as Error);
      }
    })();

    repo.setOnMutate(scheduleSync);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runOnce();
    };
    const onOnline = () => void runOnce();
    const onOffline = () => {
      if (getSyncConfig() && !cancelled) setStatus('offline');
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const flush = () => void repo.flush();
    window.addEventListener('beforeunload', flush);

    return () => {
      cancelled = true;
      registerEventSink(null);
      repo.setOnMutate(null);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', flush);
      if (pushTimer) clearTimeout(pushTimer);
      void repo.flush();
    };
  }, [repo]);

  const sync = useMemo<SyncState>(
    () => ({ status, lastSyncedAt, dataVersion, refresh: () => refreshRef.current() }),
    [status, lastSyncedAt, dataVersion],
  );

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-danger">Could not open local storage.</p>
        <p className="text-xs text-muted">{error.message}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <RepositoryContext.Provider value={repo}>
      <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
    </RepositoryContext.Provider>
  );
}

/** Access the initialised Repository. Throws if used outside the provider. */
export function useRepository(): Repository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within a RepositoryProvider');
  return ctx;
}

/** Access cloud-sync status (for the indicator + data-freshness on screens). */
export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a RepositoryProvider');
  return ctx;
}
