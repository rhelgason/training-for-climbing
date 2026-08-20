import { dayIndex } from '../../lib/day';
/**
 * Self-assessment reassessment nudge — the book's "Cycle of Improvement": reassess
 * periodically so training keeps targeting the right weakness. Cadence comes from
 * the user's profile (`reassessWeeks`). Pure and unit-testable; mirrors the
 * fitness-evaluation retest helpers.
 */
import type { AssessmentRecord } from '../../db/types';

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
 * `reassessWeeks` weeks since the last one.
 */
export function reassessDue(
  assessments: AssessmentRecord[],
  nowMs: number,
  reassessWeeks: number,
): boolean {
  const days = daysSinceLastAssessment(assessments, nowMs);
  return days !== null && days >= reassessWeeks * 7;
}
