/** Pure helpers for the macrocycle planner. No I/O — unit-testable. */
import type { MacrocyclePeriodRecord, SessionRecord } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PeriodValidation {
  valid: boolean;
  errors: string[];
}

/** A period needs a label and an end date on or after the start date. */
export function validatePeriodInput(input: {
  label?: string;
  startDate?: number | null;
  endDate?: number | null;
}): PeriodValidation {
  const errors: string[] = [];
  if (!input.label || input.label.trim().length === 0) errors.push('Give the period a label.');
  if (typeof input.startDate !== 'number') errors.push('Enter a valid start date (YYYY-MM-DD).');
  if (typeof input.endDate !== 'number') errors.push('Enter a valid end date (YYYY-MM-DD).');
  if (
    typeof input.startDate === 'number' &&
    typeof input.endDate === 'number' &&
    input.endDate < input.startDate
  ) {
    errors.push('End date must be on or after the start date.');
  }
  return { valid: errors.length === 0, errors };
}

/** The period whose date range contains `nowMs`, or null. */
export function currentPeriod(
  periods: MacrocyclePeriodRecord[],
  nowMs: number,
): MacrocyclePeriodRecord | null {
  return periods.find((p) => nowMs >= p.startDate && nowMs <= p.endDate) ?? null;
}

/** Count of distinct calendar days within [start, end] on which a session was logged. */
export function trainingDaysInRange(
  sessions: SessionRecord[],
  startMs: number,
  endMs: number,
): number {
  const days = new Set<number>();
  for (const s of sessions) {
    if (s.date >= startMs && s.date <= endMs) days.add(Math.floor(s.date / MS_PER_DAY));
  }
  return days.size;
}

/** Parse a YYYY-MM-DD string to epoch ms (UTC midnight), or null if invalid. */
export function parseYmd(input: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  // Reject overflow (e.g. Feb 31 rolling into March).
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/** Format epoch ms as YYYY-MM-DD (UTC). */
export function formatYmd(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}
