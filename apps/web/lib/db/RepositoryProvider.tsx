'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { log, registerEventSink, trackEvent, type Repository } from '@tfc/core';
import { WebRepository } from './webRepository';

const RepositoryContext = createContext<Repository | null>(null);

/**
 * Creates and initialises the browser Repository once, wires usage events to it,
 * flushes pending writes on tab close, and blocks rendering until the local
 * store has hydrated from IndexedDB.
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => new WebRepository(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await repo.init();
        registerEventSink((event) => {
          repo.recordEvent(event).catch((err) => log.error('failed to persist event', err));
        });
        if (!cancelled) {
          setReady(true);
          trackEvent('app_opened');
        }
      } catch (err) {
        log.error('repository init failed', err);
        if (!cancelled) setError(err as Error);
      }
    })();

    const flush = () => void repo.flush();
    window.addEventListener('beforeunload', flush);

    return () => {
      cancelled = true;
      registerEventSink(null);
      window.removeEventListener('beforeunload', flush);
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
