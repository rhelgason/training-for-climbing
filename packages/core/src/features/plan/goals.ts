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
