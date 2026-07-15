import { relativeTime } from './format';

const NOW = 1_000_000_000_000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('shows "just now" under a minute (and for future timestamps)', () => {
    expect(relativeTime(NOW - 30 * 1000, NOW)).toBe('just now');
    expect(relativeTime(NOW + 5 * MIN, NOW)).toBe('just now');
  });

  it('shows minutes, hours, and days', () => {
    expect(relativeTime(NOW - 5 * MIN, NOW)).toBe('5m ago');
    expect(relativeTime(NOW - 2 * HOUR, NOW)).toBe('2h ago');
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe('3d ago');
  });

  it('floors to the largest whole unit', () => {
    expect(relativeTime(NOW - (90 * MIN - 1), NOW)).toBe('1h ago');
    expect(relativeTime(NOW - (DAY - 1), NOW)).toBe('23h ago');
  });
});
