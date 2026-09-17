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

  const runRefresh = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    const config = getSyncConfig();
    if (!isSyncConfigured(config)) {
      setStatus('error');
      setErrorMessage('Not signed in — the coach needs an account session.');
      return;
    }
    try {
      const fresh = await refreshCoachSuggestion(repo, config, contextKey);
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
      log.warn('coach refresh failed; staying on the deterministic plan', err);
      setErrorMessage(message);
      setStatus('error');
    }
  }, [repo, contextKey]);

  useEffect(() => {
    // Wait until the caller knows today's context; fetching before then would
    // burn a call on a context we're about to replace.
    if (contextKey === undefined) return;
    let on = true;
    (async () => {
      const profile = await repo.getProfile();
      if (!on) return;
      const cached = getCachedSuggestion();
      const config = getSyncConfig();
      if (cached) {
        setSuggestion(cached.suggestion);
        setGeneratedAt(cached.generatedAt);
      }
      const isEnabled = Boolean(profile?.aiCoachEnabled) && isSyncConfigured(config);
      setEnabled(isEnabled);

      const stale = !cached || cached.contextKey !== contextKey;
      if (isEnabled && stale && autoTriedKey.current !== contextKey) {
        autoTriedKey.current = contextKey;
        void runRefresh();
      }
    })();
    return () => {
      on = false;
    };
  }, [repo, runRefresh, contextKey]);

  const refresh = useCallback(() => {
    void runRefresh();
  }, [runRefresh]);

  return { suggestion, generatedAt, status, enabled, errorMessage, refresh };
}
