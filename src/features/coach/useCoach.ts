/**
 * useCoach — surfaces the cached AI suggestion plus refresh.
 *
 * Refresh is budget-aware: the cached suggestion shows instantly and offline,
 * and we call the LLM at most ~once per day automatically (when the cache is
 * missing or stale and the coach is enabled). Tapping "refresh" forces a call.
 * Any failure leaves the screen on the deterministic baseline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Repository } from '../../db/repository';
import { now } from '../../lib/clock';
import { getSyncConfig, isSyncConfigured } from '../sync/syncConfig';
import { refreshCoachSuggestion } from './coach';
import { getCachedSuggestion } from './coachCache';
import type { CoachSuggestion } from './types';

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

export function useCoach(repo: Repository): CoachState {
  const [suggestion, setSuggestion] = useState<CoachSuggestion | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<CoachStatus>('idle');
  const [enabled, setEnabled] = useState(false);
  // Ensures the daily auto-refresh fires at most once per mount.
  const autoTried = useRef(false);

  const runRefresh = useCallback(async () => {
    setStatus('loading');
    const config = await getSyncConfig();
    if (!isSyncConfigured(config)) {
      setStatus('error');
      return;
    }
    try {
      const fresh = await refreshCoachSuggestion(repo, config);
      setSuggestion(fresh);
      setGeneratedAt(now());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [repo]);

  useEffect(() => {
    let on = true;
    (async () => {
      const [cached, profile, config] = await Promise.all([
        getCachedSuggestion(),
        repo.getProfile(),
        getSyncConfig(),
      ]);
      if (!on) return;
      if (cached) {
        setSuggestion(cached.suggestion);
        setGeneratedAt(cached.generatedAt);
      }
      const isEnabled = Boolean(profile?.aiCoachEnabled) && isSyncConfigured(config);
      setEnabled(isEnabled);

      // Daily auto-refresh: fetch once if enabled and the cache is missing/stale.
      const stale = !cached || now() - cached.generatedAt > COACH_STALE_MS;
      if (isEnabled && stale && !autoTried.current) {
        autoTried.current = true;
        void runRefresh();
      }
    })();
    return () => {
      on = false;
    };
  }, [repo, runRefresh]);

  const refresh = useCallback(() => {
    void runRefresh();
  }, [runRefresh]);

  return { suggestion, generatedAt, status, enabled, refresh };
}
