'use client';

/**
 * useCoach (web) — surfaces the cached AI suggestion plus refresh.
 *
 * One AI call per distinct training picture: a new calendar day, a changed
 * check-in, or new journal text. The cache is only for identical context, so
 * opening the app twice on the same day with the same logs is free; logging an
 * injury and coming back is not. Tapping "refresh" forces a call. Any failure
 * leaves the screen on the deterministic baseline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoachUnavailableError,
  log,
  now,
  isSyncConfigured,
  type Repository,
  type CoachSuggestion,
} from '@tfc/core';
import { getSyncConfig } from '../auth/session';
import { getCachedSuggestion } from './cache';
import { refreshCoachSuggestion } from './coach';
import { decideCoachFetch } from './decide';

/** Keys an automatic call has already started. Survives a route change. */
const callsStarted = new Set<string>();
/** The in-flight request, so a second mount waits on it instead of calling again. */
const inflight = new Map<string, Promise<CoachSuggestion>>();
const FAILED_KEY = 'tfc.coachAutoFailed';

function readFailedKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(FAILED_KEY);
  } catch {
    return null;
  }
}

function writeFailedKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (key) window.sessionStorage.setItem(FAILED_KEY, key);
    else window.sessionStorage.removeItem(FAILED_KEY);
  } catch {
    // Private mode can reject storage. The in-memory set still dedupes this tab.
  }
}

export type CoachStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CoachState {
  suggestion: CoachSuggestion | null;
  generatedAt: number | null;
  status: CoachStatus;
  /** True when the AI coach is opted-in (profile) and the server is configured. */
  enabled: boolean;
  /** The real failure reason when status is `error`; null otherwise. */
  errorMessage: string | null;
  refresh: () => void;
}

export function useCoach(repo: Repository, contextKey?: string): CoachState {
  const [suggestion, setSuggestion] = useState<CoachSuggestion | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<CoachStatus>('idle');
  const [enabled, setEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** The context key we last auto-fetched for, so we try each one only once. */
  const autoTriedKey = useRef<string | null>(null);

  const runRefresh = useCallback(
    async (reason: 'auto' | 'manual') => {
      log.info('coach: request started', { reason });
      setStatus('loading');
      setErrorMessage(null);
      const config = getSyncConfig();
      if (!isSyncConfigured(config)) {
        log.warn('coach: not signed in, skipping the call', { reason });
        setStatus('error');
        setErrorMessage('Not signed in — the coach needs an account session.');
        return;
      }
      const key = contextKey ?? '';
      if (reason === 'manual') inflight.delete(key);
      let pending = reason === 'auto' ? inflight.get(key) : undefined;
      if (!pending) {
        pending = refreshCoachSuggestion(repo, config, contextKey);
        if (reason === 'auto' && contextKey) inflight.set(contextKey, pending);
      }
      try {
        const fresh = await pending;
        writeFailedKey(null);
        log.info('coach: request finished', {
          reason,
          restDay: fresh.restDay ?? false,
          headline: fresh.headline,
        });
        setSuggestion(fresh);
        setGeneratedAt(now());
        setStatus('ready');
      } catch (err) {
        const message =
          err instanceof CoachUnavailableError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        if (reason === 'auto' && contextKey) {
          writeFailedKey(contextKey);
          callsStarted.delete(contextKey);
        }
        log.warn('coach: request failed; staying on the deterministic plan', { reason, message });
        setErrorMessage(message);
        setStatus('error');
      } finally {
        if (contextKey) inflight.delete(contextKey);
      }
    },
    [repo, contextKey],
  );

  useEffect(() => {
    // Wait until the caller knows today's context; fetching before then would
    // burn a call on a context we're about to replace.
    if (contextKey === undefined) {
      log.info('coach: no context yet');
      return;
    }
    let on = true;
    const cached = getCachedSuggestion();
    // Show the saved plan before the profile read, so a route back to Train
    // does not flash a different session and then replace it.
    if (cached && cached.contextKey === contextKey) {
      setSuggestion(cached.suggestion);
      setGeneratedAt(cached.generatedAt);
      setStatus('ready');
    }
    (async () => {
      const profile = await repo.getProfile();
      if (!on) return;
      const config = getSyncConfig();
      const isEnabled = Boolean(profile?.aiCoachEnabled) && isSyncConfigured(config);
      setEnabled(isEnabled);
      const decision = decideCoachFetch({
        enabled: isEnabled,
        contextKey,
        cachedKey: cached?.contextKey,
        autoStarted: callsStarted.has(contextKey) || autoTriedKey.current === contextKey,
        autoFailed: readFailedKey() === contextKey,
      });
      log.info('coach: decide', { action: decision.action, reason: decision.reason });
      if (decision.action === 'use-cache' && cached) {
        setSuggestion(cached.suggestion);
        setGeneratedAt(cached.generatedAt);
        setStatus('ready');
        return;
      }
      if (decision.action === 'skip') {
        const pending = inflight.get(contextKey);
        if (!pending) return;
        setStatus('loading');
        void pending
          .then((fresh) => {
            if (!on) return;
            setSuggestion(fresh);
            setGeneratedAt(now());
            setStatus('ready');
            log.info('coach: joined the in-flight request', { headline: fresh.headline });
          })
          .catch((err: unknown) => {
            if (!on) return;
            const message = err instanceof Error ? err.message : String(err);
            log.warn('coach: in-flight request failed', { message });
            setErrorMessage(message);
            setStatus('error');
          });
        return;
      }
      // A suggestion from a different day or check-in is not this plan. Showing
      // it while the new call is in flight is how yesterday's rest day stays on
      // screen after they say they feel fine.
      setSuggestion(null);
      setGeneratedAt(null);
      callsStarted.add(contextKey);
      autoTriedKey.current = contextKey;
      void runRefresh('auto');
    })();
    return () => {
      on = false;
    };
  }, [repo, runRefresh, contextKey]);

  const refresh = useCallback(() => {
    if (contextKey) {
      callsStarted.delete(contextKey);
      inflight.delete(contextKey);
      writeFailedKey(null);
    }
    log.info('coach: manual refresh');
    void runRefresh('manual');
  }, [runRefresh, contextKey]);

  return { suggestion, generatedAt, status, enabled, errorMessage, refresh };
}
