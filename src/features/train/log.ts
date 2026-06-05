/**
 * Pure helpers for the training log. No I/O — unit-testable.
 *
 * Rest awareness is grounded in the book: the Self-Assessment flags "I climb
 * three or four days in a row" (Q9) as an overtraining risk, and Chapter 8
 * stresses adequate rest between hard days. We treat 3+ consecutive training
 * days as the point to recommend rest.
 */
import type { SessionRecord } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The book's threshold: climbing/training this many days in a row risks overtraining. */
export const REST_AFTER_CONSECUTIVE_DAYS = 3;

/** Calendar-day index for an epoch-ms timestamp. */
export function dayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

/** Was anything logged on the calendar day containing `nowMs`? */
export function trainedToday(sessions: SessionRecord[], nowMs: number): boolean {
  const today = dayIndex(nowMs);
  return sessions.some((s) => dayIndex(s.date) === today);
}

/**
 * Number of consecutive calendar days ending today on which at least one
 * session was logged. Returns 0 if today has no session (i.e. you've rested).
 */
export function currentStreak(sessions: SessionRecord[], nowMs: number): number {
  const days = new Set(sessions.map((s) => dayIndex(s.date)));
  const today = dayIndex(nowMs);
  if (!days.has(today)) return 0;
  let count = 0;
  let d = today;
  while (days.has(d)) {
    count += 1;
    d -= 1;
  }
  return count;
}

/** True when the current streak has reached the book's overtraining threshold. */
export function restRecommended(streak: number): boolean {
  return streak >= REST_AFTER_CONSECUTIVE_DAYS;
}

/** Whole days since the most recent session, or null if none logged. */
export function daysSinceLastSession(sessions: SessionRecord[], nowMs: number): number | null {
  if (sessions.length === 0) return null;
  const latest = Math.max(...sessions.map((s) => dayIndex(s.date)));
  return dayIndex(nowMs) - latest;
}
