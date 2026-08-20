/**
 * Coach orchestration (web) — gathers the user's data, builds the context, asks
 * the server (via the /api proxy) for a suggestion, and caches it. Mirrors the
 * mobile coach.ts but uses the web localStorage cache.
 */
import {
  buildCoachContext,
  requestCoachSuggestion,
  now,
  type Repository,
  type SyncConfig,
  type CoachSuggestion,
} from '@tfc/core';
import { saveCachedSuggestion } from './cache';

export async function refreshCoachSuggestion(
  repo: Repository,
  config: SyncConfig,
  contextKey?: string,
): Promise<CoachSuggestion> {
  const nowMs = now();
  const [profile, assessments, benchmarks, climbs, goals, journals, dailyContext] =
    await Promise.all([
      repo.getProfile(),
      repo.listAssessments(),
      repo.listBenchmarks(),
      repo.listClimbs(),
      repo.listGoals(),
      repo.listJournals(),
      repo.getDailyContext(nowMs),
    ]);

  const context = buildCoachContext({
    profile,
    assessments,
    benchmarks,
    climbs,
    goals,
    journals,
    dailyContext,
    nowMs,
  });

  const suggestion = await requestCoachSuggestion(config, context);
  saveCachedSuggestion({ suggestion, generatedAt: nowMs, contextKey });
  return suggestion;
}
