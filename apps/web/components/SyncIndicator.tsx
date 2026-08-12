'use client';

import { useSync } from '../lib/db/RepositoryProvider';

/**
 * A small floating chip that surfaces transient sync states — syncing, offline,
 * or a failure (with retry). Hidden when idle; steady-state reassurance ("last
 * synced …") lives on the Settings screen. Sits above the mobile tab bar.
 */
export function SyncIndicator() {
  const { status, refresh } = useSync();
  if (status === 'idle') return null;

  const base =
    'fixed right-4 bottom-20 z-40 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-lg backdrop-blur md:bottom-4';

  if (status === 'syncing') {
    return (
      <div className={`${base} border-border bg-surface/90 text-muted`}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
        Syncing…
      </div>
    );
  }

  if (status === 'offline') {
    return <div className={`${base} border-warning/40 bg-warning/10 text-warning`}>⚠ Offline</div>;
  }

  // The session was rejected (expired, or the signing secret was rotated).
  // Retrying can't help, so point at sign-in instead of offering it.
  if (status === 'signed-out') {
    return (
      <div className={`${base} border-warning/40 bg-warning/10 text-warning`}>
        Session expired
        <a href="/more" className="underline underline-offset-2">
          Sign in
        </a>
      </div>
    );
  }

  // error
  return (
    <div className={`${base} border-danger/40 bg-danger/10 text-danger`}>
      ⚠ Sync failed
      <button type="button" onClick={refresh} className="underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}
