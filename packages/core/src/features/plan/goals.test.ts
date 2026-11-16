import type { GoalRecord } from '../../db/types';
import {
  activeGoals,
  completedGoals,
  goalExtension,
  groupGoalsByHorizon,
  isOverdue,
  validateGoalInput,
} from './goals';

function goal(partial: Partial<GoalRecord>): GoalRecord {
  return {
    id: partial.id ?? 'g',
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    horizon: partial.horizon ?? 'medium',
    title: partial.title ?? 'Goal',
    status: partial.status ?? 'active',
    ...partial,
  };
}

describe('validateGoalInput', () => {
  it('requires a non-empty title', () => {
    expect(validateGoalInput({ title: 'Send 5.11' }).valid).toBe(true);
    expect(validateGoalInput({ title: '   ' }).valid).toBe(false);
    expect(validateGoalInput({}).errors).toHaveLength(1);
  });
});

describe('groupGoalsByHorizon', () => {
  it('buckets goals by horizon', () => {
    const goals = [
      goal({ id: '1', horizon: 'short' }),
      goal({ id: '2', horizon: 'long' }),
      goal({ id: '3', horizon: 'short' }),
    ];
    const grouped = groupGoalsByHorizon(goals);
    expect(grouped.short.map((g) => g.id)).toEqual(['1', '3']);
    expect(grouped.medium).toHaveLength(0);
    expect(grouped.long.map((g) => g.id)).toEqual(['2']);
  });
});

describe('status filters', () => {
  const goals = [goal({ id: '1', status: 'active' }), goal({ id: '2', status: 'done' })];
  it('separates active and completed', () => {
    expect(activeGoals(goals).map((g) => g.id)).toEqual(['1']);
    expect(completedGoals(goals).map((g) => g.id)).toEqual(['2']);
  });
});

describe('isOverdue', () => {
  it('is true only for active goals past their deadline', () => {
    expect(isOverdue(goal({ status: 'active', targetDate: 100 }), 200)).toBe(true);
    expect(isOverdue(goal({ status: 'active', targetDate: 300 }), 200)).toBe(false);
    expect(isOverdue(goal({ status: 'done', targetDate: 100 }), 200)).toBe(false);
    expect(isOverdue(goal({ status: 'active' }), 200)).toBe(false);
  });
});

describe('goalExtension', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const window = (days: number, horizon: GoalRecord['horizon'] = 'medium') =>
    goalExtension(goal({ createdAt: 0, targetDate: days * DAY, horizon }));

  it('gives a third of the original window, in words that read cleanly', () => {
    expect(window(7, 'short')).toEqual({ days: 7, label: '1 week' });
    expect(window(30)).toEqual({ days: 14, label: '2 weeks' });
    expect(window(90)).toEqual({ days: 30, label: '1 month' });
    expect(window(180)).toEqual({ days: 60, label: '2 months' });
    expect(window(365, 'long')).toEqual({ days: 120, label: '4 months' });
  });

  it('never gives less than a week or more than six months', () => {
    expect(window(1, 'short')).toEqual({ days: 7, label: '1 week' });
    expect(window(1825, 'long')).toEqual({ days: 180, label: '6 months' });
  });

  it('falls back to the horizon when the goal never had a deadline', () => {
    expect(goalExtension(goal({ horizon: 'medium' }))).toEqual({ days: 30, label: '1 month' });
  });
});
