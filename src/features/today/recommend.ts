/**
 * "What should I work on today?" — a faithful synthesis of the book's guidance,
 * not invented coaching. Pure and unit-testable.
 *
 * Rules, each grounded in Hörst:
 *  - If you've trained 3+ days in a row → rest (Self-Assessment Q9 / Ch 8 rest).
 *  - Otherwise target your weakest triad area (Ch 2: "the most effective training
 *    program targets this area for improvement").
 *  - If no assessment exists yet → take it first (it drives everything).
 *  - Keep active short/medium-term goals in view (Ch 2 goal-setting).
 */
import { TRIAD_LABELS, type TriadArea } from '../../content/types';
import type { GoalRecord } from '../../db/types';
import { activeGoals } from '../plan/goals';
import { currentStreak, restRecommended } from '../train/log';

export interface DailyInput {
  /** Weakest triad area from the latest assessment, or null if none taken. */
  weakestArea: TriadArea | null;
  goals: GoalRecord[];
  /** Epoch-ms dates that count as training (journals + climbs). */
  trainingDates: number[];
  nowMs: number;
}

export type DailyKind = 'rest' | 'assess' | 'train';

export interface DailyRecommendation {
  kind: DailyKind;
  streak: number;
  headline: string;
  detail: string;
  focusArea: TriadArea | null;
  /** Titles of active short/medium-term goals to keep in mind. */
  goalReminders: string[];
}

const FOCUS_DETAIL: Record<TriadArea, string> = {
  mental:
    'Your weakest area is the mental game. Climb for practice and work mental skills — visualization, breathing, and focus.',
  technical:
    'Your weakest area is technique. Prioritise deliberate skill practice — footwork and movement — on climbs within your limit.',
  physical:
    'Your weakest area is physical. After a full warm-up, train in hierarchy order: skill → max strength/power → endurance → conditioning.',
};

function goalReminders(goals: GoalRecord[]): string[] {
  return activeGoals(goals)
    .filter((g) => g.horizon === 'short' || g.horizon === 'medium')
    .slice(0, 3)
    .map((g) => g.title);
}

export function buildDailyRecommendation(input: DailyInput): DailyRecommendation {
  const streak = currentStreak(input.trainingDates, input.nowMs);
  const reminders = goalReminders(input.goals);

  if (restRecommended(streak)) {
    return {
      kind: 'rest',
      streak,
      headline: 'Take a rest day',
      detail: `You've trained ${streak} days in a row. Hörst warns that 3–4 days in a row risks overtraining — rest is when you get stronger.`,
      focusArea: null,
      goalReminders: reminders,
    };
  }

  if (input.weakestArea === null) {
    return {
      kind: 'assess',
      streak,
      headline: 'Start with a self-assessment',
      detail:
        'Take the 30-question self-assessment so the app can target your weakest area of the performance triad.',
      focusArea: null,
      goalReminders: reminders,
    };
  }

  return {
    kind: 'train',
    streak,
    headline: `Focus on ${TRIAD_LABELS[input.weakestArea]}`,
    detail: FOCUS_DETAIL[input.weakestArea],
    focusArea: input.weakestArea,
    goalReminders: reminders,
  };
}
