import type { SessionRecord } from '../../db/types';
import {
  REST_AFTER_CONSECUTIVE_DAYS,
  currentStreak,
  daysSinceLastSession,
  dayIndex,
  restRecommended,
  trainedToday,
} from './log';

const DAY = 24 * 60 * 60 * 1000;
// A fixed "now" well away from the epoch boundary.
const NOW = 1000 * DAY + DAY / 2;

function session(dayOffset: number): SessionRecord {
  return {
    id: `s${dayOffset}`,
    createdAt: 0,
    date: NOW + dayOffset * DAY,
    focusAreas: ['skill'],
  };
}

describe('dayIndex', () => {
  it('maps timestamps on the same calendar day to the same index', () => {
    expect(dayIndex(NOW)).toBe(dayIndex(NOW + DAY / 4));
    expect(dayIndex(NOW + DAY)).toBe(dayIndex(NOW) + 1);
  });
});

describe('trainedToday', () => {
  it('detects a session logged today regardless of time of day', () => {
    expect(trainedToday([session(0)], NOW)).toBe(true);
    expect(trainedToday([session(-1)], NOW)).toBe(false);
    expect(trainedToday([], NOW)).toBe(false);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak([session(0), session(-1), session(-2)], NOW)).toBe(3);
  });

  it('is 0 when today has no session (a rest day)', () => {
    expect(currentStreak([session(-1), session(-2)], NOW)).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak([session(0), session(-1), session(-3)], NOW)).toBe(2);
  });

  it('counts multiple sessions on the same day once', () => {
    expect(currentStreak([session(0), session(0), session(-1)], NOW)).toBe(2);
  });
});

describe('restRecommended', () => {
  it('triggers at the book threshold of 3 consecutive days', () => {
    expect(restRecommended(REST_AFTER_CONSECUTIVE_DAYS - 1)).toBe(false);
    expect(restRecommended(REST_AFTER_CONSECUTIVE_DAYS)).toBe(true);
    expect(restRecommended(REST_AFTER_CONSECUTIVE_DAYS + 1)).toBe(true);
  });
});

describe('daysSinceLastSession', () => {
  it('returns whole days since the most recent session, or null when empty', () => {
    expect(daysSinceLastSession([], NOW)).toBeNull();
    expect(daysSinceLastSession([session(0)], NOW)).toBe(0);
    expect(daysSinceLastSession([session(-3), session(-5)], NOW)).toBe(3);
  });
});
