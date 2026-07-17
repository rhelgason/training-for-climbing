/**
 * Coach orchestration — gathers the user's data from the repository, builds the
 * context, asks the server for a suggestion, and caches it. Glue around the pure
 * `buildCoachContext` and the `requestCoachSuggestion` client.
 */
import {
  buildCoachContext,
  type CoachSuggestion,
  type Repository,
  requestCoachSuggestion,
} from '@tfc/core';
import { now } from '../../lib/clock';
import type { SyncConfig } from '../sync/syncConfig';
import { saveCachedSuggestion } from './coachCache';

/**
 * Fetch a fresh AI suggestion and cache it. Throws `CoachUnavailableError` when
 * the coach can't be reached — callers fall back to the deterministic baseline.
 */
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
  await saveCachedSuggestion({ suggestion, generatedAt: nowMs });
  return suggestion;
}
