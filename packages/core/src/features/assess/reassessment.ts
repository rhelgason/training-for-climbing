import { dayIndex } from '../../lib/day';
/**
 * Self-assessment reassessment nudge — the book's "Cycle of Improvement": reassess
 * periodically so training keeps targeting the right weakness. The cadence is
 * the app's call, not a setting: a climber asked "how often should I reassess?"
 * has no better answer than we do, and one more knob is one more thing to
 * misconfigure. Pure and unit-testable; mirrors the fitness-evaluation retest
 * helpers.
 */
import type { AssessmentRecord } from '../../db/types';

/**
 * A season: long enough for training to move the triad, short enough to steer
 * by. The book sets no interval — it says to reassess on a plateau, training
 * that feels flat, or a drop in motivation (Ch 1, Cycle of Improvement) — so
 * this is the ceiling, not the only trigger worth having.
 */
export const REASSESS_DAYS = 90;

/** Whole days since the most recent self-assessment, or null if none taken. */
export function daysSinceLastAssessment(
  assessments: AssessmentRecord[],
  nowMs: number,
): number | null {
  if (assessments.length === 0) return null;
  const latest = Math.max(...assessments.map((a) => a.createdAt));
  return dayIndex(nowMs) - dayIndex(latest);
}

/**
 * True when it's time to reassess: an assessment exists and it's been at least
 * `everyDays` since the last one.
 */
export function reassessDue(
  assessments: AssessmentRecord[],
  nowMs: number,
  everyDays: number = REASSESS_DAYS,
): boolean {
  const days = daysSinceLastAssessment(assessments, nowMs);
  return days !== null && days >= everyDays;
}
