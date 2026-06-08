import type { ClimbRecord, JournalEntry } from '../../db/types';
import {
  REST_AFTER_CONSECUTIVE_DAYS,
  currentStreak,
  dayIndex,
  daysSinceLastTraining,
  restRecommended,
  trainedToday,
  trainingDates,
} from './log';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function dates(...dayOffsets: number[]): number[] {
  return dayOffsets.map((o) => NOW + o * DAY);
}

describe('dayIndex', () => {
  it('maps timestamps on the same calendar day to the same index', () => {
    expect(dayIndex(NOW)).toBe(dayIndex(NOW + DAY / 4));
    expect(dayIndex(NOW + DAY)).toBe(dayIndex(NOW) + 1);
  });
});

describe('trainingDates', () => {
  const journal = (dayOffset: number, activities: JournalEntry['activities']): JournalEntry => ({
    id: `j${dayOffset}`,
    createdAt: 0,
    updatedAt: 0,
    date: NOW + dayOffset * DAY,
    activities,
  });
  const climb = (dayOffset: number): ClimbRecord => ({
    id: `c${dayOffset}`,
    createdAt: 0,
    updatedAt: 0,
    date: NOW + dayOffset * DAY,
    environment: 'indoor',
    discipline: 'boulder',
    grade: 'V3',
    outcome: 'send',
  });

  it('counts journals with real activity and any climb, but not rest-only days', () => {
    const result = trainingDates(
      [journal(0, ['climbing']), journal(-1, ['rest']), journal(-2, [])],
      [climb(-3)],
    );
    // day 0 (activity), day -3 (climb). day -1 rest-only and day -2 empty excluded.
    expect(result.map(dayIndex).sort()).toEqual([dayIndex(NOW - 3 * DAY), dayIndex(NOW)].sort());
  });
});

describe('trainedToday', () => {
  it('detects a training date today regardless of time', () => {
    expect(trainedToday(dates(0), NOW)).toBe(true);
    expect(trainedToday(dates(-1), NOW)).toBe(false);
    expect(trainedToday([], NOW)).toBe(false);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(dates(0, -1, -2), NOW)).toBe(3);
  });

  it('is 0 when today is a rest day', () => {
    expect(currentStreak(dates(-1, -2), NOW)).toBe(0);
  });

  it('stops at the first gap and dedupes same-day dates', () => {
    expect(currentStreak(dates(0, -1, -3), NOW)).toBe(2);
    expect(currentStreak(dates(0, 0, -1), NOW)).toBe(2);
  });
});

describe('restRecommended', () => {
  it('triggers at the book threshold of 3 consecutive days', () => {
    expect(restRecommended(REST_AFTER_CONSECUTIVE_DAYS - 1)).toBe(false);
    expect(restRecommended(REST_AFTER_CONSECUTIVE_DAYS)).toBe(true);
  });
});

describe('daysSinceLastTraining', () => {
  it('returns whole days since the most recent training date, or null', () => {
    expect(daysSinceLastTraining([], NOW)).toBeNull();
    expect(daysSinceLastTraining(dates(0), NOW)).toBe(0);
    expect(daysSinceLastTraining(dates(-3, -5), NOW)).toBe(3);
  });
});
