/**
 * Pure helpers for training-day awareness. No I/O — unit-testable.
 *
 * A "training day" is any day with a journal entry that has a non-rest activity,
 * or a logged climb. Rest awareness is grounded in the book: the Self-Assessment
 * flags "I climb three or four days in a row" (Q9) as an overtraining risk, and
 * Chapter 8 stresses adequate rest — so 3+ consecutive training days → rest.
 */
import { isTrainingActivity } from '../../content/journal';
import type { ClimbRecord, JournalEntry } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The book's threshold: training this many days in a row risks overtraining. */
export const REST_AFTER_CONSECUTIVE_DAYS = 3;

/** Calendar-day index for an epoch-ms timestamp. */
export function dayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

/** Epoch-ms dates that count as training (journal with real activity, or a climb). */
export function trainingDates(journals: JournalEntry[], climbs: ClimbRecord[]): number[] {
  const dates: number[] = [];
  for (const j of journals) if (isTrainingActivity(j.activities)) dates.push(j.date);
  for (const c of climbs) dates.push(c.date);
  return dates;
}

/** Was a training day logged on the calendar day containing `nowMs`? */
export function trainedToday(dates: number[], nowMs: number): boolean {
  const today = dayIndex(nowMs);
  return dates.some((d) => dayIndex(d) === today);
}

/**
 * Consecutive calendar days ending today that were training days. Returns 0 if
 * today wasn't a training day (i.e. you've rested today).
 */
export function currentStreak(dates: number[], nowMs: number): number {
  const days = new Set(dates.map(dayIndex));
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

/**
 * The run of training days the climber arrives at today *with*.
 *
 * `currentStreak` counts from today and so reads 0 until today is logged, which
 * makes it the wrong input for deciding whether to train — it can only ever
 * advise rest after the session has already happened. This counts the run
 * ending yesterday, including today only if today is already logged.
 */
export function priorTrainingRun(dates: number[], nowMs: number): number {
  const days = new Set(dates.map(dayIndex));
  const today = dayIndex(nowMs);
  let day = days.has(today) ? today : today - 1;
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day -= 1;
  }
  return count;
}

/** Whole days since the most recent training day, or null if none. */
export function daysSinceLastTraining(dates: number[], nowMs: number): number | null {
  if (dates.length === 0) return null;
  const latest = Math.max(...dates.map(dayIndex));
  return dayIndex(nowMs) - latest;
}
