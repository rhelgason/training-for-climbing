'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  HttpRemoteStore,
  log,
  now,
  registerEventSink,
  runSync,
  trackEvent,
  type Repository,
} from '@tfc/core';
import { WebRepository } from './webRepository';
import { API_BASE } from '../config';
import { getSession, getSyncConfig, saveSession } from '../auth/session';

/** Debounce a push after local edits; cap the blocking initial pull. */
const PUSH_DEBOUNCE_MS = 1500;
const INITIAL_SYNC_TIMEOUT_MS = 6000;

const RepositoryContext = createContext<Repository | null>(null);

/**
 * Creates and initialises the browser Repository once, wires usage events + auto
 * sync, and blocks rendering until the local store has hydrated (and, when signed
 * in, until an initial pull from the server completes so other devices' data
 * shows on load).
 *
 * Auto-sync: after each local mutation we debounce-push to the server, and we
 * pull whenever the tab regains focus. Sign-in/out and manual "Sync now" still
 * work via the Account screen.
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => new WebRepository(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let dirtyDuringSync = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;

    // Pull remote, merge, push merged back. Serialised: overlapping requests are
    // coalesced into one follow-up run.
    const runOnce = async (): Promise<void> => {
      const cfg = getSyncConfig();
      if (!cfg) return;
      if (syncing) {
        dirtyDuringSync = true;
        return;
      }
      syncing = true;
      try {
        await repo.flush();
        await runSync(repo, new HttpRemoteStore(API_BASE, cfg.token));
        const s = getSession();
        if (s) saveSession({ ...s, lastSyncedAt: now() });
      } catch (err) {
        log.error('auto-sync failed', err);
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

    (async () => {
      try {
        await repo.init();
        registerEventSink((event) => {
          repo.recordEvent(event).catch((err) => log.error('failed to persist event', err));
        });
        // When signed in, pull before first render so a fresh device shows the
        // account's data — but cap the wait so a slow/cold server can't hang load.
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

    // Push after local edits; pull when the tab regains focus.
    repo.setOnMutate(scheduleSync);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runOnce();
    };
    document.addEventListener('visibilitychange', onVisible);
    const flush = () => void repo.flush();
    window.addEventListener('beforeunload', flush);

    return () => {
      cancelled = true;
      registerEventSink(null);
      repo.setOnMutate(null);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', flush);
      if (pushTimer) clearTimeout(pushTimer);
      void repo.flush();
    };
  }, [repo]);

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

  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

/** Access the initialised Repository. Throws if used outside the provider. */
export function useRepository(): Repository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within a RepositoryProvider');
  return ctx;
}
