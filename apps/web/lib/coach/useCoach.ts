'use client';

/**
 * useCoach (web) — surfaces the cached AI suggestion plus refresh.
 *
 * The cached suggestion shows instantly and offline; we call the LLM at most
 * ~once per day automatically (when the cache is missing or stale and the coach
 * is enabled). Tapping "refresh" forces a call. Any failure leaves the screen on
 * the deterministic baseline.
 *
 * A `contextKey` invalidates the cache on top of the time-based staleness. It
 * fingerprints today's check-in, so saying "actually I'm tired" regenerates the
 * advice instead of leaving stale AI guidance sitting above a deterministic
 * plan that has already changed underneath it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { now, isSyncConfigured, type Repository, type CoachSuggestion } from '@tfc/core';
import { getSyncConfig } from '../auth/session';
import { getCachedSuggestion } from './cache';
import { refreshCoachSuggestion } from './coach';

export type CoachStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Auto-refresh once the cached suggestion is older than this. */
export const COACH_STALE_MS = 18 * 60 * 60 * 1000; // 18h

export interface CoachState {
  suggestion: CoachSuggestion | null;
  generatedAt: number | null;
  status: CoachStatus;
  /** True when the AI coach is opted-in (profile) and the server is configured. */
  enabled: boolean;
  refresh: () => void;
}

export function useCoach(repo: Repository, contextKey?: string): CoachState {
  const [suggestion, setSuggestion] = useState<CoachSuggestion | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<CoachStatus>('idle');
  const [enabled, setEnabled] = useState(false);
  /** The context key we last auto-fetched for, so we try each one only once. */
  const autoTriedKey = useRef<string | null>(null);

  const runRefresh = useCallback(async () => {
    setStatus('loading');
    const config = getSyncConfig();
    if (!isSyncConfigured(config)) {
      setStatus('error');
      return;
    }
    try {
      const fresh = await refreshCoachSuggestion(repo, config, contextKey);
      setSuggestion(fresh);
      setGeneratedAt(now());
      setStatus('ready');
    } catch {
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

      const stale =
        !cached || now() - cached.generatedAt > COACH_STALE_MS || cached.contextKey !== contextKey;
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

  return { suggestion, generatedAt, status, enabled, refresh };
}
