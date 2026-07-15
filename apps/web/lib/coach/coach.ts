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
): Promise<CoachSuggestion> {
  const nowMs = now();
  const [profile, assessments, benchmarks, climbs, goals, journals] = await Promise.all([
    repo.getProfile(),
    repo.listAssessments(),
    repo.listBenchmarks(),
    repo.listClimbs(),
    repo.listGoals(),
    repo.listJournals(),
  ]);

  const context = buildCoachContext({
    profile,
    assessments,
    benchmarks,
    climbs,
    goals,
    journals,
    nowMs,
  });

  const suggestion = await requestCoachSuggestion(config, context);
  saveCachedSuggestion({ suggestion, generatedAt: nowMs });
  return suggestion;
}
