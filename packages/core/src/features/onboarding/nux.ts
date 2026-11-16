/**
 * The first-use tutorial: which step a new climber is on.
 *
 * Progress is read from their data rather than stored as a pointer. "Has an
 * assessment" and "has a goal" are facts the app already keeps, so closing
 * the app halfway through can't lose a step, and finishing one on another
 * device counts here too. Only the last step — seeing the plan explained —
 * leaves no trace in the data, so finishing it writes `nuxCompletedAt`.
 *
 * The order is the order a plan needs things: the assessment says where they
 * are, a goal says where they're going, the check-in says what today allows,
 * and then there is a session to show them.
 */
import type { ProfileRecord } from '../../db/types';
import { dayIndex } from '../../lib/day';

export type NuxStep = 'assess' | 'goal' | 'checkin' | 'plan';

export const NUX_STEPS: NuxStep[] = ['assess', 'goal', 'checkin', 'plan'];

/** Days of history that mark an account as already using the app. */
const ESTABLISHED_AFTER_DAYS = 7;

export interface NuxInput {
  profile: ProfileRecord | null;
  assessments: number;
  goals: number;
  /** Today's check-in was confirmed. */
  checkedInToday: boolean;
  /** Dates of every journal, climb, and logged workout. */
  activityDates: number[];
  nowMs: number;
}

/**
 * An account that was training here before the tutorial existed. It is never
 * sent through it; the caller stamps `nuxCompletedAt` so this stays decided.
 */
export function isEstablishedAccount(input: Pick<NuxInput, 'activityDates' | 'nowMs'>): boolean {
  const today = dayIndex(input.nowMs);
  return input.activityDates.some((d) => today - dayIndex(d) >= ESTABLISHED_AFTER_DAYS);
}

/** The step to show, or null when the tutorial is finished or not due yet. */
export function currentNuxStep(input: NuxInput): NuxStep | null {
  // No profile yet means sign-up hasn't run; the tutorial starts after it.
  if (input.profile === null) return null;
  if (input.profile.nuxCompletedAt) return null;
  if (isEstablishedAccount(input)) return null;
  if (input.assessments === 0) return 'assess';
  if (input.goals === 0) return 'goal';
  if (!input.checkedInToday) return 'checkin';
  return 'plan';
}
