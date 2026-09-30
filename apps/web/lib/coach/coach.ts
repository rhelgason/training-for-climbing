/**
 * Coach orchestration (web) — gathers the user's data, builds the context, asks
 * the server (via the /api proxy) for a suggestion, and caches it. Mirrors the
 * mobile coach.ts but uses the web localStorage cache.
 */
import {
  buildCoachContext,
  log,
  now,
  requestCoachSuggestion,
  type CoachSuggestion,
  type Repository,
  type SyncConfig,
} from '@tfc/core';
import { saveCachedSuggestion } from './cache';

export async function refreshCoachSuggestion(
  repo: Repository,
  config: SyncConfig,
  contextKey?: string,
): Promise<CoachSuggestion> {
  const nowMs = now();
  const [
    profile,
    assessments,
    benchmarks,
    climbs,
    goals,
    journals,
    dailyContext,
    periods,
    checkins,
  ] = await Promise.all([
    repo.getProfile(),
    repo.listAssessments(),
    repo.listBenchmarks(),
    repo.listClimbs(),
    repo.listGoals(),
    repo.listJournals(),
    repo.getDailyContext(nowMs),
    repo.listMacrocyclePeriods(),
    repo.listCheckins(),
  ]);

  const context = buildCoachContext({
    profile,
    assessments,
    benchmarks,
    climbs,
    goals,
    journals,
    dailyContext,
    periods,
    checkins,
    nowMs,
  });

  log.info('coach: context', {
    restDay: context.schedule.restDay,
    restReason: context.schedule.restReason,
    offFingers: context.schedule.offFingers ?? false,
    fingerDaysInARow: context.schedule.fingerDaysInARow,
    fingerDaysThisWeek: context.schedule.fingerDaysThisWeek,
    suggestedFocus: context.schedule.suggestedFocus,
    readiness: context.today.readiness,
    trainingPush: context.profile.trainingPush,
    injury: context.schedule.injury?.summary,
  });
  const suggestion = await requestCoachSuggestion(config, context);
  saveCachedSuggestion({ suggestion, generatedAt: nowMs, contextKey });
  log.info('coach: cached suggestion', {
    restDay: suggestion.restDay ?? false,
    headline: suggestion.headline,
    steps: suggestion.plan.length,
  });

  // Don't write the model's injury list onto the profile. Tomorrow's plan
  // re-reads the journals. A saved note would outlive the entries that produced it.
  return suggestion;
}
