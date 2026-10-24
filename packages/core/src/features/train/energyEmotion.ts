import { dayIndex } from '../../lib/day';
/**
 * Energy-Emotion logic (Appendix B chart). Pure — unit-testable.
 *
 * Axes: energy 0..10 (Y), emotion −5..+5 (X). The chart is split into four
 * quadrants by energy (high/low at the 5 midpoint) and emotion (positive/
 * negative at 0):
 *   I   = high energy, negative emotion
 *   II  = high energy, positive emotion  ← the performance zone
 *   III = low energy,  negative emotion
 *   IV  = low energy,  positive emotion
 */
import type { CheckinRecord } from '../../db/types';
import type { Readiness } from '../../content/trainingContext';

export const ENERGY_MIN = 0;
export const ENERGY_MAX = 10;
export const EMOTION_MIN = -5;
export const EMOTION_MAX = 5;

/** Midpoint of the energy axis; at or above is "high energy". */
export const ENERGY_MIDPOINT = 5;

export type Quadrant = 'I' | 'II' | 'III' | 'IV';

export interface QuadrantInfo {
  id: Quadrant;
  label: string;
  /** True for quadrant II — the high-energy, positive performance zone. */
  optimal: boolean;
}

const QUADRANTS: Record<Quadrant, QuadrantInfo> = {
  I: { id: 'I', label: 'High energy · negative', optimal: false },
  II: { id: 'II', label: 'High energy · positive', optimal: true },
  III: { id: 'III', label: 'Low energy · negative', optimal: false },
  IV: { id: 'IV', label: 'Low energy · positive', optimal: false },
};

export function clampEnergy(v: number): number {
  return Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, Math.round(v)));
}

export function clampEmotion(v: number): number {
  return Math.max(EMOTION_MIN, Math.min(EMOTION_MAX, Math.round(v)));
}

/** Classify a reading into its quadrant. Energy >= 5 is high; emotion >= 0 is positive. */
export function quadrantOf(energy: number, emotion: number): QuadrantInfo {
  const highEnergy = energy >= ENERGY_MIDPOINT;
  const positive = emotion >= 0;
  if (highEnergy && positive) return QUADRANTS.II;
  if (highEnergy && !positive) return QUADRANTS.I;
  if (!highEnergy && positive) return QUADRANTS.IV;
  return QUADRANTS.III;
}

const READINESS_RANK: Record<Readiness, number> = {
  fresh: 0,
  ok: 1,
  tired: 2,
  tweaky: 3,
};

/**
 * Map an energy/emotion reading onto today's readiness.
 *
 * Hörst uses the matrix (Ch 3) to notice and change a mental state, not to
 * cancel training, so a reading only ever speaks to energy. Low energy
 * (III or IV) is "tired": skip near-limit work. High energy is ready whatever
 * the mood; a negative mind-set is something to work on, not a reason to rest.
 * No reading ever means "something hurts" — that is the climber's own tap.
 */
export function readinessFromEnergyEmotion(energy: number, emotion: number): Readiness | null {
  const q = quadrantOf(energy, emotion);
  return q.id === 'III' || q.id === 'IV' ? 'tired' : null;
}

/** The more conservative of two readiness readings. */
export function combineReadiness(base: Readiness, extra: Readiness | null | undefined): Readiness {
  if (!extra) return base;
  return READINESS_RANK[extra] > READINESS_RANK[base] ? extra : base;
}

/** Latest reading on that calendar day, or null. */
export function latestReadingForDay(
  checkins: CheckinRecord[],
  dayMs: number,
): CheckinRecord | null {
  const days = readingsForDay(checkins, dayMs);
  return days.length > 0 ? days[days.length - 1] : null;
}

/** Readings whose `time` falls on the same calendar day as `dayMs`, oldest-first. */
export function readingsForDay(checkins: CheckinRecord[], dayMs: number): CheckinRecord[] {
  const day = dayIndex(dayMs);
  return checkins.filter((c) => dayIndex(c.time) === day).sort((a, b) => a.time - b.time);
}
