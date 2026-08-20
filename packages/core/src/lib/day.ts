/**
 * Calendar-day arithmetic, in the climber's **local** timezone.
 *
 * This used to be `Math.floor(ms / MS_PER_DAY)`, which is UTC. That silently
 * broke everything west of Greenwich: for a climber in California the app's
 * "day" rolled over at 5pm local, so an evening session landed on tomorrow —
 * splitting streaks, hiding the journal entry written that morning, resetting
 * the daily check-in, and changing "today's plan" mid-afternoon.
 *
 * Everything here is derived from local Y/M/D components rather than by dividing
 * milliseconds, which also makes it correct across daylight-saving transitions
 * (where a "day" is 23 or 25 hours long).
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stable integer identifying the local calendar day containing `ms`.
 * Consecutive days differ by exactly 1, so day arithmetic stays trivial.
 */
export function dayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

/** Local midnight at the start of the day containing `ms`. */
export function dayStartMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Local midnight at the start of the *next* day. Computed via date components,
 * not `+ MS_PER_DAY`, so it stays correct across DST changes.
 */
export function nextDayStartMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/** Do two timestamps fall on the same local calendar day? */
export function sameDay(a: number, b: number): boolean {
  return dayIndex(a) === dayIndex(b);
}
