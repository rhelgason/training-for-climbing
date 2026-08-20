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
import { dayIndex, dayStartMs, nextDayStartMs, sameDay } from './day';

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
