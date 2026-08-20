/**
 * Coach context builder — assembles a compact, structured snapshot of the
 * user's training picture for the AI coach.
 *
 * Pure and unit-testable. The same inputs feed the deterministic baseline, so
 * the AI and the fallback see the same facts (plus the journal free text and
 * the climber's own description of themselves, which only the AI reads).
 *
 * Two things this deliberately does *for* the model rather than leaving to it:
 *  - runs the microcycle scheduler and ships the verdict, so weekly frequency
 *    and recovery rules are enforced in code, not hoped for in a prompt; and
 *  - surfaces the last several days as a first-class `recentDays` list, because
 *    "what did I do yesterday" is the single biggest input to today's session
 *    and it should not be buried in a journal array the model may skim.
 */
import { FITNESS_TESTS } from '../../content/fitnessEvaluation';
import { DISCIPLINE_LABELS, DISCIPLINES, ENVIRONMENT_LABELS } from '../../content/climbing';
import type {
  AssessmentRecord,
  BenchmarkRecord,
  ClimbRecord,
  DailyContextRecord,
  GoalRecord,
  JournalEntry,
  ProfileRecord,
} from '../../db/types';
import { effectiveProfile } from '../../content/profile';
import { sessionFocus, type SessionFocusId } from '../../content/trainingContext';
import { flaggedPromptsForArea } from '../assess/scoring';
import { activeGoals } from '../plan/goals';
import { buildMicrocycle, type Microcycle } from '../plan/microcycle';
import { countInLastDays, hardestSend, sendRate } from '../progress/dashboard';
import { buildDailyRecommendation } from '../today/recommend';
import { loadHistory, recentDays } from '../train/load';
import { currentStreak, trainingDates } from '../train/log';
import type { CoachContext, CoachSchedule } from './types';

export interface CoachContextInput {
  profile: ProfileRecord | null;
  assessments: AssessmentRecord[];
  benchmarks: BenchmarkRecord[];
  climbs: ClimbRecord[];
  goals: GoalRecord[];
  journals: JournalEntry[];
  /** Today's check-in, if the climber filled one in. */
  dailyContext?: DailyContextRecord | null;
  nowMs: number;
}

/** Max journal entries to include — recent context without bloating the prompt. */
const MAX_JOURNALS = 10;
const MAX_GOALS = 5;
/** How many recent sessions to spell out in full for the model. */
const MAX_RECENT_DAYS = 7;

function latestAssessment(assessments: AssessmentRecord[]): AssessmentRecord | null {
  if (assessments.length === 0) return null;
  return [...assessments].sort((a, b) => b.createdAt - a.createdAt)[0];
}

function fitnessHighlights(benchmarks: BenchmarkRecord[]): CoachContext['fitness'] {
  const byTest = new Map<string, BenchmarkRecord[]>();
  for (const b of benchmarks) {
    const list = byTest.get(b.testId) ?? [];
    list.push(b);
    byTest.set(b.testId, list);
  }
  const out: CoachContext['fitness'] = [];
  for (const [testId, list] of byTest) {
    const sorted = [...list].sort((a, b) => a.date - b.date);
    const latest = sorted[sorted.length - 1];
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    let trend: CoachContext['fitness'][number]['trend'] = 'new';
    if (prev) {
      trend = latest.value > prev.value ? 'up' : latest.value < prev.value ? 'down' : 'flat';
    }
    const name = FITNESS_TESTS.find((t) => t.id === testId)?.name ?? testId;
    out.push({ test: name, latest: latest.value, trend });
  }
  return out;
}

function hardestSends(climbs: ClimbRecord[]): CoachContext['climbing']['hardestSends'] {
  const out: CoachContext['climbing']['hardestSends'] = [];
  for (const discipline of DISCIPLINES) {
    const hardest = hardestSend(climbs, discipline);
    if (hardest) out.push({ discipline: DISCIPLINE_LABELS[discipline], grade: hardest.grade });
  }
  return out;
}

function label(focus: SessionFocusId): string {
  return sessionFocus(focus).label;
}

function scheduleFrom(
  cycle: Microcycle,
  suggestedFocus: SessionFocusId | null,
  plannedDaysPerWeek: number,
): CoachSchedule {
  return {
    restDay: cycle.restDay,
    restReason: cycle.restReason,
    suggestedFocus,
    // Nothing is allowed on a rest day — matching `allowedFocuses`, so the model
    // can't route around a rest verdict by picking any still-viable focus.
    allowed: cycle.restDay
      ? []
      : cycle.verdicts
          .filter((v) => v.status !== 'blocked')
          .map((v) => ({
            focus: v.focus,
            label: v.label,
            reason: v.reason,
            usedThisWeek: v.usedThisWeek,
          })),
    blocked: cycle.verdicts
      .filter((v) => v.status === 'blocked')
      .map((v) => ({ focus: v.focus, label: v.label, reason: v.reason })),
    trainingDaysThisWeek: cycle.trainingDaysThisWeek,
    plannedDaysPerWeek,
    hardDaysInARow: cycle.hardDaysInARow,
    recentLoadSummary: cycle.recentLoadSummary,
  };
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const profile = effectiveProfile(input.profile);
  const assessment = latestAssessment(input.assessments);
  const trainDates = trainingDates(input.journals, input.climbs);
  const history = loadHistory(input.journals, input.climbs);
  const daily = input.dailyContext ?? null;

  // Today's check-in overrides the profile's usual setup where it disagrees.
  const equipment = daily?.equipment ?? profile.equipment;
  const sessionLength = daily?.sessionLength ?? profile.sessionLength;
  const readiness = daily?.readiness ?? 'ok';

  const recommendation = buildDailyRecommendation({
    weakestArea: assessment?.weakestArea ?? null,
    weakSpots: assessment
      ? flaggedPromptsForArea(assessment.responses, assessment.weakestArea)
      : [],
    goals: input.goals,
    trainingDates: trainDates,
    nowMs: input.nowMs,
    history,
    abilityTier: profile.abilityTier,
    styleFocus: profile.styleFocus,
    daysPerWeek: profile.daysPerWeek,
    equipment,
    readiness,
    sessionLength,
  });

  // `history` is always supplied above, so the scheduler always ran.
  const cycle =
    recommendation.microcycle ??
    buildMicrocycle({
      history,
      nowMs: input.nowMs,
      abilityTier: profile.abilityTier,
      weakestArea: assessment?.weakestArea ?? null,
      styleFocus: profile.styleFocus,
      daysPerWeek: profile.daysPerWeek,
      equipment,
      readiness,
      sessionLength,
    });

  return {
    generatedAt: input.nowMs,
    profile: {
      abilityTier: profile.abilityTier,
      styleFocus: profile.styleFocus,
      daysPerWeek: profile.daysPerWeek,
      sessionLength: profile.sessionLength,
      equipment: profile.equipment,
      climberContext: profile.climberContext,
    },
    today: {
      environment: ENVIRONMENT_LABELS[daily?.environment ?? 'indoor'],
      equipment,
      sessionLength,
      readiness,
      note: daily?.note,
    },
    schedule: scheduleFrom(cycle, recommendation.focus, profile.daysPerWeek),
    recentDays: recentDays(input.journals, input.climbs, input.nowMs, MAX_RECENT_DAYS).map((d) => ({
      date: d.date,
      daysAgo: d.daysAgo,
      focus: d.focusLabels,
      intensity: d.intensity,
      activities: d.activities,
      summary: d.summary,
      wins: d.wins,
      struggles: d.struggles,
      skipped: d.skipped,
      climbs: d.climbs,
    })),
    assessment: assessment
      ? {
          takenAt: assessment.createdAt,
          mental: assessment.mental,
          technical: assessment.technical,
          physical: assessment.physical,
          weakestArea: assessment.weakestArea,
          weakSpots: flaggedPromptsForArea(assessment.responses, assessment.weakestArea),
        }
      : null,
    fitness: fitnessHighlights(input.benchmarks),
    climbing: {
      sessionsLast30Days: countInLastDays(
        input.climbs.map((c) => c.date),
        input.nowMs,
        30,
      ),
      sendRate: sendRate(input.climbs),
      hardestSends: hardestSends(input.climbs),
    },
    goals: activeGoals(input.goals)
      .slice(0, MAX_GOALS)
      .map((g) => ({ horizon: g.horizon, title: g.title })),
    journals: [...input.journals]
      .sort((a, b) => b.date - a.date)
      .slice(0, MAX_JOURNALS)
      .map((j) => ({
        date: j.date,
        activities: j.activities,
        intensity: j.intensity,
        summary: j.summary,
        wins: j.wins,
        struggles: j.struggles,
      })),
    training: {
      currentStreak: currentStreak(trainDates, input.nowMs),
      daysLast14: countInLastDays(trainDates, input.nowMs, 14),
    },
    baselinePlan: recommendation.plan,
  };
}

/** Re-exported so callers can label a focus without importing the catalog. */
export { label as coachFocusLabel };
