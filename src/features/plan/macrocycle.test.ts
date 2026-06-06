import type { MacrocyclePeriodRecord, SessionRecord } from '../../db/types';
import {
  currentPeriod,
  formatYmd,
  parseYmd,
  trainingDaysInRange,
  validatePeriodInput,
} from './macrocycle';

const DAY = 24 * 60 * 60 * 1000;

function period(partial: Partial<MacrocyclePeriodRecord>): MacrocyclePeriodRecord {
  return {
    id: partial.id ?? 'p',
    createdAt: 0,
    updatedAt: 0,
    label: partial.label ?? 'Block',
    startDate: partial.startDate ?? 0,
    endDate: partial.endDate ?? DAY,
    ...partial,
  };
}

function session(dateMs: number): SessionRecord {
  return { id: `s${dateMs}`, createdAt: 0, date: dateMs, focusAreas: [] };
}

describe('validatePeriodInput', () => {
  it('requires a label and valid ordered dates', () => {
    expect(validatePeriodInput({ label: 'Base', startDate: 0, endDate: DAY }).valid).toBe(true);
    expect(validatePeriodInput({ label: '', startDate: 0, endDate: DAY }).valid).toBe(false);
    expect(validatePeriodInput({ label: 'X', startDate: null, endDate: DAY }).valid).toBe(false);
    expect(validatePeriodInput({ label: 'X', startDate: DAY, endDate: 0 }).errors).toContain(
      'End date must be on or after the start date.',
    );
  });
});

describe('currentPeriod', () => {
  it('finds the period containing now', () => {
    const periods = [
      period({ id: 'a', startDate: 0, endDate: 10 * DAY }),
      period({ id: 'b', startDate: 11 * DAY, endDate: 20 * DAY }),
    ];
    expect(currentPeriod(periods, 15 * DAY)?.id).toBe('b');
    expect(currentPeriod(periods, 100 * DAY)).toBeNull();
  });
});

describe('trainingDaysInRange', () => {
  it('counts distinct days with sessions inside the range', () => {
    const sessions = [
      session(2 * DAY),
      session(2 * DAY + 1000), // same day
      session(4 * DAY),
      session(50 * DAY), // outside
    ];
    expect(trainingDaysInRange(sessions, 0, 10 * DAY)).toBe(2);
  });
});

describe('parseYmd / formatYmd', () => {
  it('round-trips a valid date', () => {
    const ms = parseYmd('2026-03-15');
    expect(ms).not.toBeNull();
    expect(formatYmd(ms as number)).toBe('2026-03-15');
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseYmd('2026-3-5')).toBeNull();
    expect(parseYmd('not-a-date')).toBeNull();
    expect(parseYmd('2026-02-31')).toBeNull();
    expect(parseYmd('2026-13-01')).toBeNull();
  });
});
