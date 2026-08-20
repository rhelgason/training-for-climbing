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

/** Readings whose `time` falls on the same calendar day as `dayMs`, oldest-first. */
export function readingsForDay(checkins: CheckinRecord[], dayMs: number): CheckinRecord[] {
  const day = dayIndex(dayMs);
  return checkins.filter((c) => dayIndex(c.time) === day).sort((a, b) => a.time - b.time);
}
