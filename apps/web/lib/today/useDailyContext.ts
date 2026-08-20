'use client';

/**
 * Loads (or invents) today's training context and saves edits.
 *
 * The defaulting chain is what makes this one tap instead of five: today's
 * saved row → yesterday's answers → the profile's usual setup. A climber who
 * goes to the same gym every week never has to touch it, and the plan is still
 * built from accurate context.
 *
 * Readiness is the exception — it is *not* carried over. "Tired" three days ago
 * shouldn't silently suppress hard training today, so it resets to "ok" each
 * day and only counts when the climber says so.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  dayIndex,
  effectiveProfile,
  now,
  trackEvent,
  type DailyContextRecord,
  type Repository,
} from '@tfc/core';
import type { TodayContextValue } from '../../components/TodayContext';

export interface DailyContextState {
  value: TodayContextValue | null;
  /** True when today's row was actually saved, not inferred from defaults. */
  confirmed: boolean;
  /** Today's persisted record, for the coach context. Null until confirmed. */
  record: DailyContextRecord | null;
  update: (next: TodayContextValue) => void;
}

export function useDailyContext(repo: Repository, dataVersion: number): DailyContextState {
  const [value, setValue] = useState<TodayContextValue | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [record, setRecord] = useState<DailyContextRecord | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const nowMs = now();
      const [profile, contexts] = await Promise.all([repo.getProfile(), repo.listDailyContexts()]);
      if (!on) return;
      const settings = effectiveProfile(profile);
      const today = contexts.find((c) => dayIndex(c.date) === dayIndex(nowMs)) ?? null;
      const previous = contexts.find((c) => dayIndex(c.date) < dayIndex(nowMs)) ?? null;

      setRecord(today);
      setConfirmed(Boolean(today));
      setValue({
        environment: today?.environment ?? previous?.environment ?? 'indoor',
        equipment: today?.equipment ?? previous?.equipment ?? settings.equipment,
        sessionLength: today?.sessionLength ?? previous?.sessionLength ?? settings.sessionLength,
        // Deliberately not inherited from `previous` — see the module comment.
        readiness: today?.readiness ?? 'ok',
        note: today?.note,
      });
    })();
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  const update = useCallback(
    (next: TodayContextValue) => {
      setValue(next);
      setConfirmed(true);
      trackEvent('daily_context_set', {
        readiness: next.readiness,
        environment: next.environment,
      });
      void repo
        .saveDailyContext({
          date: now(),
          environment: next.environment,
          equipment: next.equipment,
          sessionLength: next.sessionLength,
          readiness: next.readiness,
          note: next.note?.trim() || undefined,
        })
        .then(setRecord);
    },
    [repo],
  );

  return { value, confirmed, record, update };
}
