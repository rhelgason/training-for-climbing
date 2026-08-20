import { dayIndex } from '../../lib/day';
/**
 * Pure helpers for the fitness self-tests (Chapters 8 & 9). No I/O — unit-testable.
 * The book says to take the 10-part test annually and compare results over time.
 */
import type { BenchmarkRecord } from '../../db/types';

/** The book recommends retaking the evaluation once a year. */
export const ANNUAL_DAYS = 365;

type Side = BenchmarkRecord['side'];

function matches(b: BenchmarkRecord, testId: string, side: Side): boolean {
  return b.testId === testId && b.side === side;
}

/** All results for a test (and side), newest-first. */
export function historyForTest(
  benchmarks: BenchmarkRecord[],
  testId: string,
  side?: Side,
): BenchmarkRecord[] {
  return benchmarks.filter((b) => matches(b, testId, side)).sort((a, b) => b.date - a.date);
}

export function latestForTest(
  benchmarks: BenchmarkRecord[],
  testId: string,
  side?: Side,
): BenchmarkRecord | null {
  return historyForTest(benchmarks, testId, side)[0] ?? null;
}

export interface Trend {
  latest: BenchmarkRecord;
  previous: BenchmarkRecord | null;
  /** latest.value − previous.value, or null when there's no prior result. */
  delta: number | null;
}

/** Latest result plus its change from the previous result, or null if never recorded. */
export function trendForTest(
  benchmarks: BenchmarkRecord[],
  testId: string,
  side?: Side,
): Trend | null {
  const history = historyForTest(benchmarks, testId, side);
  if (history.length === 0) return null;
  const [latest, previous] = history;
  return {
    latest,
    previous: previous ?? null,
    delta: previous ? latest.value - previous.value : null,
  };
}

/** Whole days since the most recent benchmark of any test, or null if none. */
export function daysSinceLastEvaluation(
  benchmarks: BenchmarkRecord[],
  nowMs: number,
): number | null {
  if (benchmarks.length === 0) return null;
  const latest = Math.max(...benchmarks.map((b) => b.date));
  return dayIndex(nowMs) - dayIndex(latest);
}

/** True when it's been at least a year since the last evaluation. */
export function retestDue(benchmarks: BenchmarkRecord[], nowMs: number): boolean {
  const days = daysSinceLastEvaluation(benchmarks, nowMs);
  return days !== null && days >= ANNUAL_DAYS;
}
