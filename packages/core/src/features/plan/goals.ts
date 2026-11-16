/** Pure helpers for working with goals. No I/O — unit-testable. */
import type { GoalHorizon } from '../../content/planning';
import { GOAL_HORIZONS } from '../../content/planning';
import type { GoalRecord } from '../../db/types';

export interface GoalValidation {
  valid: boolean;
  errors: string[];
}

/** A goal needs a non-empty title; mission/sacrifice are encouraged but optional. */
export function validateGoalInput(input: { title?: string }): GoalValidation {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length === 0) {
    errors.push('Give your goal a clear, specific title.');
  }
  return { valid: errors.length === 0, errors };
}

/** Group goals into the three horizons, preserving input order within each. */
export function groupGoalsByHorizon(goals: GoalRecord[]): Record<GoalHorizon, GoalRecord[]> {
  const groups: Record<GoalHorizon, GoalRecord[]> = { short: [], medium: [], long: [] };
  for (const goal of goals) groups[goal.horizon].push(goal);
  return groups;
}

export const HORIZON_ORDER: GoalHorizon[] = GOAL_HORIZONS.map((h) => h.id);

export function activeGoals(goals: GoalRecord[]): GoalRecord[] {
  return goals.filter((g) => g.status === 'active');
}

export function completedGoals(goals: GoalRecord[]): GoalRecord[] {
  return goals.filter((g) => g.status === 'done');
}

/** An active goal whose deadline has passed is overdue. */
export function isOverdue(goal: GoalRecord, now: number): boolean {
  return goal.status === 'active' && typeof goal.targetDate === 'number' && goal.targetDate < now;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A missed goal's window, when it never had a usable one, by horizon. */
const FALLBACK_SPAN_DAYS: Record<GoalHorizon, number> = { short: 7, medium: 90, long: 365 };

/**
 * How much more time a missed goal gets: a third of the window it was given,
 * at least a week and at most six months. A one-week goal gets another week,
 * a three-month goal another month, a year-long goal another four months —
 * enough to finish what was close, not so much that a stale goal steers the
 * season. Rounded to weeks, or to months past four weeks, so it reads cleanly.
 */
export function goalExtension(goal: GoalRecord): { days: number; label: string } {
  const span =
    goal.targetDate !== undefined && goal.targetDate > goal.createdAt
      ? Math.round((goal.targetDate - goal.createdAt) / DAY_MS)
      : FALLBACK_SPAN_DAYS[goal.horizon];
  const raw = Math.min(180, Math.max(7, span / 3));
  if (raw < 28) {
    const weeks = Math.ceil(raw / 7);
    return { days: weeks * 7, label: weeks === 1 ? '1 week' : `${weeks} weeks` };
  }
  const months = Math.round(raw / 30);
  return { days: months * 30, label: months === 1 ? '1 month' : `${months} months` };
}
