/**
 * Coach orchestration — gathers the user's data from the repository, builds the
 * context, asks the server for a suggestion, and caches it. Glue around the pure
 * `buildCoachContext` and the `requestCoachSuggestion` client.
 */
import type { Repository } from '../../db/repository';
import { now } from '../../lib/clock';
import type { SyncConfig } from '../sync/syncConfig';
import { buildCoachContext } from './context';
import { requestCoachSuggestion } from './coachClient';
import { saveCachedSuggestion } from './coachCache';
import type { CoachSuggestion } from './types';

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
