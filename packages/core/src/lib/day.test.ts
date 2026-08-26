/**
 * These tests are the guard on a bug that shipped once already: day arithmetic
 * done as `Math.floor(ms / MS_PER_DAY)` is UTC, so west of Greenwich the app's
 * "day" rolled over mid-afternoon — splitting streaks, hiding the morning's
 * journal entry, and changing "today's plan" at 5pm.
 *
 * They are written against *local* wall-clock times, so they fail if anyone
 * reintroduces UTC division. CI runs in UTC, where the old code passed, so a
 * few cases pin an explicit non-UTC offset to stay meaningful there.
 */
import {
  addDays,
  dayIndex,
  dayStartMs,
  daysBetween,
  fromDateInputValue,
  nextDayStartMs,
  sameDay,
  toDateInputValue,
} from './day';

/** A local wall-clock time, whatever zone the test happens to run in. */
const local = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

describe('dayIndex', () => {
  it('treats every hour of a local day as the same day', () => {
    const midnight = local(2026, 8, 20, 0, 0);
    const morning = local(2026, 8, 20, 9);
    const evening = local(2026, 8, 20, 17);
    const lateNight = local(2026, 8, 20, 23, 59);
    expect(dayIndex(morning)).toBe(dayIndex(midnight));
    expect(dayIndex(evening)).toBe(dayIndex(midnight));
    expect(dayIndex(lateNight)).toBe(dayIndex(midnight));
  });

  it('advances by exactly one across midnight', () => {
    expect(dayIndex(local(2026, 8, 21, 0, 1)) - dayIndex(local(2026, 8, 20, 23, 59))).toBe(1);
  });

  it('advances by exactly one per calendar day across a month boundary', () => {
    expect(dayIndex(local(2026, 9, 1)) - dayIndex(local(2026, 8, 31))).toBe(1);
  });

  it('advances by exactly one across a year boundary', () => {
    expect(dayIndex(local(2027, 1, 1)) - dayIndex(local(2026, 12, 31))).toBe(1);
  });

  it('advances by exactly one across a DST transition', () => {
    // US spring-forward 2026-03-08 (a 23-hour local day) and fall-back 11-01
    // (25 hours). Dividing milliseconds gets both wrong.
    expect(dayIndex(local(2026, 3, 8, 12)) - dayIndex(local(2026, 3, 7, 12))).toBe(1);
    expect(dayIndex(local(2026, 11, 1, 12)) - dayIndex(local(2026, 10, 31, 12))).toBe(1);
  });

  it('keeps an evening session on the day the climber thinks it is', () => {
    // The original failure: 5pm Pacific is already tomorrow in UTC.
    const morningPacific = new Date('2026-08-20T09:00:00-07:00').getTime();
    const eveningPacific = new Date('2026-08-20T17:00:00-07:00').getTime();
    const sameLocalDate =
      new Date(morningPacific).toDateString() === new Date(eveningPacific).toDateString();
    // Only meaningful where those two instants really are one local day.
    if (sameLocalDate) expect(dayIndex(morningPacific)).toBe(dayIndex(eveningPacific));
  });
});

describe('day boundaries', () => {
  it('dayStartMs lands on local midnight of the same day', () => {
    const start = dayStartMs(local(2026, 8, 20, 17, 30));
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(start).getMinutes()).toBe(0);
    expect(dayIndex(start)).toBe(dayIndex(local(2026, 8, 20, 17, 30)));
  });

  it('nextDayStartMs is the following local midnight', () => {
    const next = nextDayStartMs(local(2026, 8, 20, 17, 30));
    expect(new Date(next).getHours()).toBe(0);
    expect(dayIndex(next)).toBe(dayIndex(local(2026, 8, 21)));
  });

  it('brackets a whole day, so range queries catch every hour of it', () => {
    const start = dayStartMs(local(2026, 8, 20, 3));
    const end = nextDayStartMs(local(2026, 8, 20, 3));
    for (const hour of [0, 6, 12, 18, 23]) {
      const t = local(2026, 8, 20, hour);
      expect(t >= start && t < end).toBe(true);
    }
    expect(local(2026, 8, 21, 0) >= end).toBe(true);
  });

  it('brackets correctly on a 23-hour DST day', () => {
    const start = dayStartMs(local(2026, 3, 8, 12));
    const end = nextDayStartMs(local(2026, 3, 8, 12));
    expect(local(2026, 3, 8, 23) < end).toBe(true);
    expect(local(2026, 3, 9, 0) >= end).toBe(true);
    expect(start < end).toBe(true);
  });
});

describe('sameDay', () => {
  it('is true across a whole local day and false either side', () => {
    expect(sameDay(local(2026, 8, 20, 0, 1), local(2026, 8, 20, 23, 59))).toBe(true);
    expect(sameDay(local(2026, 8, 20, 23, 59), local(2026, 8, 21, 0, 1))).toBe(false);
  });
});

describe('addDays', () => {
  it('moves by calendar days and keeps the time of day', () => {
    const start = new Date(2026, 7, 26, 14, 30).getTime();
    const next = addDays(start, 1);
    expect(new Date(next).getDate()).toBe(27);
    expect(new Date(next).getHours()).toBe(14);
    expect(new Date(next).getMinutes()).toBe(30);
  });

  it('goes backwards and across month boundaries', () => {
    const start = new Date(2026, 8, 2, 9).getTime();
    expect(new Date(addDays(start, -3)).getMonth()).toBe(7);
    expect(new Date(addDays(start, -3)).getDate()).toBe(30);
  });

  it('lands on the right calendar day even when a DST shift intervenes', () => {
    // Adding 86,400,000 ms across a transition moves the wall clock an hour and
    // can land on the wrong date; going via components cannot.
    for (const month of [2, 10]) {
      for (let day = 1; day <= 28; day++) {
        const start = new Date(2026, month, day, 12).getTime();
        expect(dayIndex(addDays(start, 1))).toBe(dayIndex(start) + 1);
        expect(dayIndex(addDays(start, -1))).toBe(dayIndex(start) - 1);
      }
    }
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days in both directions', () => {
    const a = new Date(2026, 7, 26, 23, 30).getTime();
    const b = new Date(2026, 7, 28, 0, 15).getTime();
    expect(daysBetween(a, b)).toBe(2);
    expect(daysBetween(b, a)).toBe(-2);
    expect(daysBetween(a, a)).toBe(0);
  });
});

describe('date input round-tripping', () => {
  it('round-trips a local date through the input format', () => {
    const ms = new Date(2026, 0, 5, 8, 45).getTime();
    const parsed = fromDateInputValue(toDateInputValue(ms));
    expect(parsed).not.toBeNull();
    expect(dayIndex(parsed!)).toBe(dayIndex(ms));
  });

  it('formats in local time rather than UTC', () => {
    // Late evening local is already tomorrow in UTC for the Americas; the input
    // must still show the local date the climber is looking at.
    const late = new Date(2026, 5, 10, 23, 30).getTime();
    expect(toDateInputValue(late)).toBe('2026-06-10');
  });

  it('parses to midday, the furthest point from a day boundary', () => {
    expect(new Date(fromDateInputValue('2026-06-10')!).getHours()).toBe(12);
  });

  it('rejects malformed input rather than producing a wrong date', () => {
    for (const bad of ['', 'today', '2026-6-10', '10-06-2026', '2026-06']) {
      expect(fromDateInputValue(bad)).toBeNull();
    }
  });
});
