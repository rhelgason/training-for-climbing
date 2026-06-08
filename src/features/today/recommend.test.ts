import type { GoalRecord } from '../../db/types';
import { buildDailyRecommendation, type DailyInput } from './recommend';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function trainDates(...dayOffsets: number[]): number[] {
  return dayOffsets.map((o) => NOW + o * DAY);
}

function goal(partial: Partial<GoalRecord>): GoalRecord {
  return {
    id: partial.id ?? 'g',
    createdAt: 0,
    updatedAt: 0,
    horizon: partial.horizon ?? 'medium',
    title: partial.title ?? 'Goal',
    status: partial.status ?? 'active',
    ...partial,
  };
}

function input(overrides: Partial<DailyInput> = {}): DailyInput {
  return { weakestArea: 'physical', goals: [], trainingDates: [], nowMs: NOW, ...overrides };
}

describe('buildDailyRecommendation', () => {
  it('recommends rest after 3 consecutive training days', () => {
    const rec = buildDailyRecommendation(input({ trainingDates: trainDates(0, -1, -2) }));
    expect(rec.kind).toBe('rest');
    expect(rec.streak).toBe(3);
  });

  it('prompts an assessment when none has been taken', () => {
    const rec = buildDailyRecommendation(input({ weakestArea: null }));
    expect(rec.kind).toBe('assess');
    expect(rec.focusArea).toBeNull();
  });

  it('targets the weakest area when rested and assessed', () => {
    const rec = buildDailyRecommendation(input({ weakestArea: 'mental' }));
    expect(rec.kind).toBe('train');
    expect(rec.focusArea).toBe('mental');
    expect(rec.headline).toMatch(/Mental/);
  });

  it('rest takes priority over a known weakest area', () => {
    const rec = buildDailyRecommendation(
      input({ weakestArea: 'technical', trainingDates: trainDates(0, -1, -2) }),
    );
    expect(rec.kind).toBe('rest');
  });

  it('emits a concrete physical plan that warms up and names a library exercise', () => {
    const rec = buildDailyRecommendation(input({ weakestArea: 'physical' }));
    expect(rec.plan[0]).toMatch(/Warm up/i);
    expect(rec.plan.some((s) => /Max strength & power:/.test(s))).toBe(true);
    expect(rec.plan[rec.plan.length - 1]).toMatch(/Cool down/i);
  });

  it('emits mental-game drills when the mental area is weakest', () => {
    const rec = buildDailyRecommendation(input({ weakestArea: 'mental' }));
    expect(rec.plan.some((s) => /visualization|breathing|fall|now/i.test(s))).toBe(true);
  });

  it('suggests recovery steps on a rest day', () => {
    const rec = buildDailyRecommendation(input({ trainingDates: trainDates(0, -1, -2) }));
    expect(rec.kind).toBe('rest');
    expect(rec.plan.some((s) => /sleep|recovery|rest/i.test(s))).toBe(true);
  });

  it('surfaces up to three active short/medium-term goals only', () => {
    const rec = buildDailyRecommendation(
      input({
        goals: [
          goal({ id: '1', horizon: 'short', title: 'A' }),
          goal({ id: '2', horizon: 'medium', title: 'B' }),
          goal({ id: '3', horizon: 'long', title: 'C' }), // excluded (long-term)
          goal({ id: '4', horizon: 'short', title: 'D', status: 'done' }), // excluded (done)
          goal({ id: '5', horizon: 'short', title: 'E' }),
          goal({ id: '6', horizon: 'short', title: 'F' }), // 4th active short/medium → trimmed
        ],
      }),
    );
    expect(rec.goalReminders).toEqual(['A', 'B', 'E']);
  });
});
