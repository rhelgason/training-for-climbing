import { dayIndex } from '../../lib/day';
/** Pure helpers for the macrocycle planner. No I/O — unit-testable. */
import type { MacrocyclePeriodRecord } from '../../db/types';
import type { SessionFocusId } from '../../content/trainingContext';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Map a block's free-text emphasis onto session focuses the scheduler can
 * prefer. Hörst's annual plan is written in these terms (skill/stamina, max
 * strength, power, power-endurance, taper); the planner stores them as a
 * sentence, so this is a best-effort read, not a second form.
 */
const BLOCK_FOCUS_ALIASES: { pattern: RegExp; focuses: SessionFocusId[] }[] = [
  { pattern: /taper|deload|peak week|rest week/i, focuses: ['skill', 'conditioning'] },
  {
    pattern: /power[\s-]*endurance|\bpe\b|4\s*[x×]\s*4|anaerobic/i,
    focuses: ['powerEndurance'],
  },
  { pattern: /max[\s-]*strength|fingerboard|hangboard|limit strength/i, focuses: ['maxStrength'] },
  { pattern: /\bpower\b|campus|contact strength|explosive/i, focuses: ['power'] },
  { pattern: /aerobic|stamina|arc|local endurance/i, focuses: ['enduranceAerobic'] },
  { pattern: /skill|technique|movement|mileage/i, focuses: ['skill'] },
  { pattern: /mental|fear|visuali/i, focuses: ['mental'] },
  { pattern: /antagonist|core|condition/i, focuses: ['conditioning'] },
];

/**
 * Hörst 4-3-2-1 mesocycle for intermediates (Ch 10): 4 weeks skill/stamina,
 * 3 weeks max strength/power, 2 weeks power-endurance, 1 week taper. Used
 * when the climber has not typed their own blocks.
 */
export const HORST_4321: {
  weeks: number;
  label: string;
  focus: string;
  focuses: SessionFocusId[];
}[] = [
  {
    weeks: 4,
    label: 'Skill & stamina',
    focus: 'Volume of submaximal climbing — ARC, mileage, skill',
    focuses: ['skill', 'enduranceAerobic'],
  },
  {
    weeks: 3,
    label: 'Max strength & power',
    focus: 'Short near-limit efforts, hangboard, campus — 48h apart',
    focuses: ['maxStrength', 'power'],
  },
  {
    weeks: 2,
    label: 'Power endurance',
    focus: '4x4s and repeaters for 2–4 weeks, then stop',
    focuses: ['powerEndurance'],
  },
  {
    weeks: 1,
    label: 'Taper',
    focus: 'Keep intensity, cut volume ~50% then ~75%; last 1–2 days mobility',
    focuses: ['skill', 'conditioning'],
  },
];

const CYCLE_WEEKS = HORST_4321.reduce((sum, p) => sum + p.weeks, 0);

export interface TrainingBlock {
  label: string;
  focus: string;
  focuses: SessionFocusId[];
  source: 'planned' | 'auto';
  daysRemaining: number;
}

/** Anchor for the rolling 4-3-2-1: onboarded date, else profile created, else first training. */
export function mesocycleAnchor(
  profile: { onboardedAt?: number; createdAt?: number } | null,
  earliestTrainingMs: number | null,
  nowMs: number,
): number {
  return profile?.onboardedAt ?? profile?.createdAt ?? earliestTrainingMs ?? nowMs;
}

export function autoMesocyclePhase(nowMs: number, startMs: number): TrainingBlock {
  const elapsedWeeks = Math.max(0, Math.floor((nowMs - startMs) / (7 * MS_PER_DAY)));
  const weekInCycle = elapsedWeeks % CYCLE_WEEKS;
  let cursor = 0;
  for (const phase of HORST_4321) {
    if (weekInCycle < cursor + phase.weeks) {
      const weekIntoPhase = weekInCycle - cursor;
      const daysRemaining = (phase.weeks - weekIntoPhase) * 7;
      return {
        label: phase.label,
        focus: phase.focus,
        focuses: phase.focuses,
        source: 'auto',
        daysRemaining,
      };
    }
    cursor += phase.weeks;
  }
  const last = HORST_4321[HORST_4321.length - 1];
  return {
    label: last.label,
    focus: last.focus,
    focuses: last.focuses,
    source: 'auto',
    daysRemaining: 7,
  };
}

/** Planned block if one is in range; otherwise the rolling 4-3-2-1. */
export function resolveTrainingBlock(
  periods: MacrocyclePeriodRecord[],
  nowMs: number,
  cycleStartMs: number,
): TrainingBlock {
  const planned = currentPeriod(periods, nowMs);
  if (planned) {
    const focuses = inferBlockFocuses(planned);
    return {
      label: planned.label,
      focus: planned.focus ?? planned.objective ?? planned.label,
      focuses: focuses.length > 0 ? focuses : autoMesocyclePhase(nowMs, cycleStartMs).focuses,
      source: 'planned',
      daysRemaining: daysRemainingInPeriod(planned, nowMs),
    };
  }
  return autoMesocyclePhase(nowMs, cycleStartMs);
}

export function inferBlockFocuses(period: MacrocyclePeriodRecord | null): SessionFocusId[] {
  if (!period) return [];
  const blob = [period.focus, period.label, period.objective, period.notes]
    .filter(Boolean)
    .join(' ');
  if (!blob.trim()) return [];
  const found: SessionFocusId[] = [];
  for (const { pattern, focuses } of BLOCK_FOCUS_ALIASES) {
    if (!pattern.test(blob)) continue;
    for (const focus of focuses) {
      if (!found.includes(focus)) found.push(focus);
    }
  }
  return found;
}

/** The next period that starts after `nowMs`, or null. */
export function upcomingPeriod(
  periods: MacrocyclePeriodRecord[],
  nowMs: number,
): MacrocyclePeriodRecord | null {
  return (
    [...periods].filter((p) => p.startDate > nowMs).sort((a, b) => a.startDate - b.startDate)[0] ??
    null
  );
}

export function daysRemainingInPeriod(period: MacrocyclePeriodRecord, nowMs: number): number {
  return Math.max(0, Math.ceil((period.endDate - nowMs) / MS_PER_DAY));
}

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

/** Count of distinct calendar days within [start, end] among the given training dates. */
export function trainingDaysInRange(dates: number[], startMs: number, endMs: number): number {
  const days = new Set<number>();
  for (const d of dates) {
    if (d >= startMs && d <= endMs) days.add(dayIndex(d));
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
