import type { GoalRecord } from '../../db/types';
import { planNods } from './nods';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function goal(over: Partial<GoalRecord>): GoalRecord {
  return {
    id: over.title ?? 'g',
    createdAt: 0,
    updatedAt: 0,
    horizon: 'medium',
    title: 'Goal',
    status: 'active',
    ...over,
  };
}

describe('planNods', () => {
  it('says nothing when there is nothing set up', () => {
    expect(planNods({ goals: [], weakestArea: null, todayArea: null, nowMs: NOW })).toEqual([]);
  });

  it('reminds them of the nearest deadline over an undated goal', () => {
    const goals = [
      goal({ title: 'Climb more', horizon: 'short' }),
      goal({ title: 'Send V7', targetDate: NOW + 41 * DAY }),
      goal({ title: 'Trip', targetDate: NOW + 90 * DAY }),
    ];
    expect(planNods({ goals, weakestArea: null, todayArea: null, nowMs: NOW })).toEqual([
      'Remember: Send V7 — 41 days left',
    ]);
  });

  it('falls back to the shortest horizon, skipping finished and lapsed goals', () => {
    const goals = [
      goal({ title: 'Long', horizon: 'long' }),
      goal({ title: 'Done', horizon: 'short', status: 'done' }),
      goal({ title: 'Lapsed', targetDate: NOW - 3 * DAY }),
      goal({ title: 'Short', horizon: 'short' }),
    ];
    expect(planNods({ goals, weakestArea: null, todayArea: null, nowMs: NOW })).toEqual([
      'Remember: Short',
    ]);
  });

  it('names the weakest area only when today trains it', () => {
    const base = { goals: [], weakestArea: 'mental' as const, nowMs: NOW };
    expect(planNods({ ...base, todayArea: 'physical' })).toEqual([]);
    expect(planNods({ ...base, todayArea: 'mental' })).toEqual([
      'Mental is your weakest area — today works on it',
    ]);
  });
});
