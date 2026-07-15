/**
 * Pure aggregations for the progress dashboard. No I/O — unit-testable.
 * Surfaces what a climber tends to care about: hardest sends, the send
 * pyramid, send/onsight rates, recent volume, and triad progression.
 */
import { isSend, type ClimbDiscipline } from '../../content/climbing';
import { gradeRank } from '../../content/grades';
import type { AssessmentRecord, ClimbRecord } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function sends(climbs: ClimbRecord[]): ClimbRecord[] {
  return climbs.filter((c) => isSend(c.outcome));
}

/** Hardest sent climb of a discipline (by grade rank), or null. */
export function hardestSend(
  climbs: ClimbRecord[],
  discipline: ClimbDiscipline,
): ClimbRecord | null {
  const eligible = climbs.filter(
    (c) => c.discipline === discipline && isSend(c.outcome) && gradeRank(discipline, c.grade) >= 0,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) =>
    gradeRank(discipline, c.grade) > gradeRank(discipline, best.grade) ? c : best,
  );
}

export interface PyramidRow {
  grade: string;
  count: number;
}

/** Counts of sent grades for a discipline, hardest first (the redpoint pyramid). */
export function sendPyramid(climbs: ClimbRecord[], discipline: ClimbDiscipline): PyramidRow[] {
  const counts = new Map<string, number>();
  for (const c of climbs) {
    if (c.discipline !== discipline || !isSend(c.outcome)) continue;
    if (gradeRank(discipline, c.grade) < 0) continue;
    counts.set(c.grade, (counts.get(c.grade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => gradeRank(discipline, b.grade) - gradeRank(discipline, a.grade));
}

/** Fraction of logged climbs that were sends (0..1). */
export function sendRate(climbs: ClimbRecord[]): number {
  if (climbs.length === 0) return 0;
  return sends(climbs).length / climbs.length;
}

/** Fraction of sends that were onsights or flashes (first-try sends). */
export function firstTryRate(climbs: ClimbRecord[]): number {
  const s = sends(climbs);
  if (s.length === 0) return 0;
  const firstTry = s.filter((c) => c.outcome === 'onsight' || c.outcome === 'flash').length;
  return firstTry / s.length;
}

/** Count of items (by epoch-ms timestamp) within the last `days` days. */
export function countInLastDays(timestamps: number[], nowMs: number, days: number): number {
  const cutoff = nowMs - days * MS_PER_DAY;
  return timestamps.filter((t) => t >= cutoff && t <= nowMs).length;
}

export interface MonthBucket {
  label: string;
  count: number;
}

/**
 * Counts of timestamps bucketed into the last `months` calendar months
 * (oldest-first), each labelled with its short month name.
 */
export function monthlyCounts(timestamps: number[], nowMs: number, months: number): MonthBucket[] {
  const base = new Date(nowMs);
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const startMs = start.getTime();
    const endMs = end.getTime();
    buckets.push({
      label: start.toLocaleDateString(undefined, { month: 'short' }),
      count: timestamps.filter((t) => t >= startMs && t < endMs).length,
    });
  }
  return buckets;
}

export interface WeekBucket {
  label: string;
  count: number;
}

/**
 * Counts of timestamps bucketed into the last `weeks` rolling 7-day windows
 * (oldest-first), each labelled with the window's start date (M/D). Used for the
 * training-consistency chart.
 */
export function weeklyCounts(timestamps: number[], nowMs: number, weeks: number): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const endMs = nowMs - i * 7 * MS_PER_DAY;
    const startMs = endMs - 7 * MS_PER_DAY;
    buckets.push({
      label: new Date(startMs).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      count: timestamps.filter((t) => t > startMs && t <= endMs).length,
    });
  }
  return buckets;
}

export interface TriadPoint {
  date: number;
  mental: number;
  technical: number;
  physical: number;
}

/** Assessment triad scores over time, oldest-first, for trend display. */
export function triadSeries(assessments: AssessmentRecord[]): TriadPoint[] {
  return [...assessments]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => ({
      date: a.createdAt,
      mental: a.mental,
      technical: a.technical,
      physical: a.physical,
    }));
}
