/**
 * useCoach — surfaces the cached AI suggestion and a manual refresh action.
 *
 * Refresh is **manual on purpose**: the free LLM tier has a weekly budget, so we
 * never auto-call on every screen focus. The cached suggestion shows instantly
 * and offline; tapping "refresh" spends one call. When the coach is disabled or
 * unreachable the screen falls back to the deterministic baseline.
 */
import { useCallback, useEffect, useState } from 'react';

import type { Repository } from '../../db/repository';
import { getSyncConfig, isSyncConfigured } from '../sync/syncConfig';
import { refreshCoachSuggestion } from './coach';
import { getCachedSuggestion } from './coachCache';
import type { CoachSuggestion } from './types';

export type CoachStatus = 'idle' | 'loading' | 'ready' | 'error';

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
      setEnabled(Boolean(profile?.aiCoachEnabled) && isSyncConfigured(config));
    })();
    return () => {
      on = false;
    };
  }, [repo]);

  const refresh = useCallback(() => {
    setStatus('loading');
    (async () => {
      const config = await getSyncConfig();
      if (!isSyncConfigured(config)) {
        setStatus('error');
        return;
      }
      try {
        const fresh = await refreshCoachSuggestion(repo, config);
        setSuggestion(fresh);
        setGeneratedAt(Date.now());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, [repo]);

  return { suggestion, generatedAt, status, enabled, refresh };
}
