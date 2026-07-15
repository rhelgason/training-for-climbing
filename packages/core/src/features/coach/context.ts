/**
 * Coach context builder — assembles a compact, structured snapshot of the user's
 * training picture for the AI coach. Pure and unit-testable; the same inputs feed
 * the deterministic baseline, so the AI and the fallback see the same facts (plus
 * the journal free text, which only the AI reads).
 */
import { FITNESS_TESTS } from '../../content/fitnessEvaluation';
import { DISCIPLINE_LABELS, DISCIPLINES } from '../../content/climbing';
import type {
  AssessmentRecord,
  BenchmarkRecord,
  ClimbRecord,
  GoalRecord,
  JournalEntry,
  ProfileRecord,
} from '../../db/types';
import { effectiveProfile } from '../../content/profile';
import { flaggedPromptsForArea } from '../assess/scoring';
import { activeGoals } from '../plan/goals';
import { countInLastDays, hardestSend, sendRate } from '../progress/dashboard';
import { currentStreak, trainingDates } from '../train/log';
import type { CoachContext } from './types';

export interface CoachContextInput {
  profile: ProfileRecord | null;
  assessments: AssessmentRecord[];
  benchmarks: BenchmarkRecord[];
  climbs: ClimbRecord[];
  goals: GoalRecord[];
  journals: JournalEntry[];
  nowMs: number;
}

/** Max journal entries to include — recent context without bloating the prompt. */
const MAX_JOURNALS = 10;
const MAX_GOALS = 5;

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

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const profile = effectiveProfile(input.profile);
  const assessment = latestAssessment(input.assessments);
  const trainDates = trainingDates(input.journals, input.climbs);

  return {
    generatedAt: input.nowMs,
    profile: { abilityTier: profile.abilityTier },
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
  };
}
