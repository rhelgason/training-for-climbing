/**
 * Nods — at most two short lines under today's plan that tie it back to what
 * the climber set up: a goal worth remembering, and the weakest area when
 * today actually works on it.
 *
 * Deliberately not a "why" on every step. The plan should be trusted, not
 * annotated; a nod is the reminder that it was built from their own inputs.
 */
import { TRIAD_LABELS, type TriadArea } from '../../content/types';
import type { GoalRecord } from '../../db/types';
import { dayIndex } from '../../lib/day';
import { activeGoals } from '../plan/goals';

export interface NodInput {
  goals: GoalRecord[];
  /** From the latest self-assessment, or null when none was taken. */
  weakestArea: TriadArea | null;
  /** The triad area today's session trains, or null on a rest day. */
  todayArea: TriadArea | null;
  nowMs: number;
}

/** The goal most worth a reminder: the nearest open deadline, else the nearest horizon. */
function headlineGoal(goals: GoalRecord[], nowMs: number): GoalRecord | null {
  const active = activeGoals(goals);
  const dated = active
    .filter((g) => g.targetDate !== undefined && dayIndex(g.targetDate) >= dayIndex(nowMs))
    .sort((a, b) => a.targetDate! - b.targetDate!);
  if (dated.length > 0) return dated[0];
  const order = { short: 0, medium: 1, long: 2 } as const;
  return [...active].sort((a, b) => order[a.horizon] - order[b.horizon])[0] ?? null;
}

export function planNods(input: NodInput): string[] {
  const nods: string[] = [];
  const goal = headlineGoal(input.goals, input.nowMs);
  if (goal) {
    const left =
      goal.targetDate !== undefined ? dayIndex(goal.targetDate) - dayIndex(input.nowMs) : null;
    nods.push(
      left === null
        ? `Remember: ${goal.title}`
        : left === 0
          ? `Remember: ${goal.title} — deadline today`
          : `Remember: ${goal.title} — ${left} day${left === 1 ? '' : 's'} left`,
    );
  }
  if (input.weakestArea && input.todayArea === input.weakestArea) {
    nods.push(`${TRIAD_LABELS[input.weakestArea]} is your weakest area — today works on it`);
  }
  return nods;
}
