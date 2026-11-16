/**
 * Where today's guided session is up to, so pausing — or closing the app on
 * the way to the gym — resumes at the same step. One run per calendar day;
 * yesterday's half-finished run is not today's.
 *
 * The steps are copied in when the run starts. The plan can change underneath
 * (a coach answer landing, a check-in edit), and a run that renumbers itself
 * mid-session is worse than one that finishes the plan it began.
 */
import { dayIndex, type DailyRecommendation } from '@tfc/core';

export type RunStep = DailyRecommendation['steps'][number];

export interface RunState {
  day: number;
  steps: RunStep[];
  /** The step on screen. */
  index: number;
  /** Texts of steps skipped so far, as the day's log records them. */
  skipped: string[];
}

const KEY = 'tfc.sessionRun';

export function loadRun(nowMs: number): RunState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    return run.day === dayIndex(nowMs) ? run : null;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Private mode: the run still works, it just won't survive a reload.
  }
}

export function clearRun(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
