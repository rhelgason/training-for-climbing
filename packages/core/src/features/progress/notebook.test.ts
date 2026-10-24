import type { ClimbRecord, ExerciseLogRecord } from '../../db/types';
import { climbingTrends, workoutTrends } from './notebook';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23);

function hangs(daysAgo: number, loadLb: number): ExerciseLogRecord {
  const date = NOW - daysAgo * DAY;
  return {
    id: `h${daysAgo}`,
    createdAt: date,
    updatedAt: date,
    date,
    workoutId: 'max-hang-10',
    edgeMm: 20,
    sets: [
      { loadLb, completed: true, rpe: 8 },
      { loadLb, completed: true, rpe: 9 },
    ],
  };
}

function send(grade: string, daysAgo: number): ClimbRecord {
  const date = NOW - daysAgo * DAY;
  return {
    id: `${grade}${daysAgo}`,
    createdAt: date,
    updatedAt: date,
    date,
    environment: 'indoor',
    discipline: 'boulder',
    grade,
    outcome: 'send',
  };
}

describe('workoutTrends', () => {
  it('charts the number per session and says how far it moved', () => {
    const [trend] = workoutTrends([hangs(2, 35), hangs(30, 20), hangs(16, 25)], NOW);
    expect(trend.workoutId).toBe('max-hang-10');
    expect(trend.points.map((p) => p.value)).toEqual([20, 25, 35]);
    expect(trend.direction).toBe('up');
    expect(trend.change).toBe('+20 lb → +35 lb over 4 weeks');
    expect(trend.latest).toMatch(/\+35 lb on 20 mm, all 2 sets clean, top RPE 9 \(2 days ago\)/);
  });

  it('leaves out workouts not logged in the last 90 days', () => {
    expect(workoutTrends([hangs(120, 30)], NOW)).toEqual([]);
  });
});

describe('climbingTrends', () => {
  it('compares the last 30 days with the 60 before', () => {
    const [boulder] = climbingTrends([send('V5', 40), send('V6', 10), send('V5', 5)], NOW);
    expect(boulder).toMatchObject({ recent: 'V6', before: 'V5', direction: 'up', sendsAtTop: 2 });
  });

  it('reads a flat month as flat', () => {
    const [boulder] = climbingTrends([send('V5', 40), send('V5', 10)], NOW);
    expect(boulder.direction).toBe('flat');
  });
});
