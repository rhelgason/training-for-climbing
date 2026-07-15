import type { BenchmarkRecord } from '../../db/types';
import {
  ANNUAL_DAYS,
  daysSinceLastEvaluation,
  historyForTest,
  latestForTest,
  retestDue,
  trendForTest,
} from './fitness';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function bm(
  testId: string,
  value: number,
  dayOffset: number,
  side?: 'left' | 'right',
): BenchmarkRecord {
  return {
    id: `${testId}-${dayOffset}-${side ?? ''}`,
    createdAt: 0,
    testId,
    side,
    value,
    date: NOW + dayOffset * DAY,
  };
}

describe('historyForTest / latestForTest', () => {
  const data = [bm('max-pullups', 10, -10), bm('max-pullups', 13, -1), bm('crunches', 40, -2)];

  it('returns a test’s results newest-first', () => {
    expect(historyForTest(data, 'max-pullups').map((b) => b.value)).toEqual([13, 10]);
  });

  it('latest picks the most recent', () => {
    expect(latestForTest(data, 'max-pullups')?.value).toBe(13);
    expect(latestForTest(data, 'never')).toBeNull();
  });

  it('separates sides for bilateral tests', () => {
    const bilateral = [bm('one-arm-lockoff', 5, -1, 'left'), bm('one-arm-lockoff', 7, -1, 'right')];
    expect(latestForTest(bilateral, 'one-arm-lockoff', 'left')?.value).toBe(5);
    expect(latestForTest(bilateral, 'one-arm-lockoff', 'right')?.value).toBe(7);
  });
});

describe('trendForTest', () => {
  it('reports delta vs the previous result', () => {
    const t = trendForTest([bm('max-pullups', 10, -10), bm('max-pullups', 13, -1)], 'max-pullups');
    expect(t?.latest.value).toBe(13);
    expect(t?.delta).toBe(3);
  });

  it('has a null delta when there is only one result', () => {
    const t = trendForTest([bm('crunches', 40, -2)], 'crunches');
    expect(t?.delta).toBeNull();
  });

  it('returns null when never recorded', () => {
    expect(trendForTest([], 'crunches')).toBeNull();
  });
});

describe('annual reminder', () => {
  it('reports days since the last evaluation, or null when none', () => {
    expect(daysSinceLastEvaluation([], NOW)).toBeNull();
    expect(daysSinceLastEvaluation([bm('crunches', 40, -30)], NOW)).toBe(30);
  });

  it('is due only after a year', () => {
    expect(retestDue([bm('crunches', 40, -(ANNUAL_DAYS - 1))], NOW)).toBe(false);
    expect(retestDue([bm('crunches', 40, -ANNUAL_DAYS)], NOW)).toBe(true);
    expect(retestDue([], NOW)).toBe(false);
  });
});
