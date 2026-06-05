import type { CheckinRecord } from '../../db/types';
import { clampEmotion, clampEnergy, quadrantOf, readingsForDay } from './energyEmotion';

describe('clamping', () => {
  it('clamps energy to 0..10 and emotion to -5..5, rounding', () => {
    expect(clampEnergy(-3)).toBe(0);
    expect(clampEnergy(99)).toBe(10);
    expect(clampEnergy(4.6)).toBe(5);
    expect(clampEmotion(-99)).toBe(-5);
    expect(clampEmotion(99)).toBe(5);
    expect(clampEmotion(2.4)).toBe(2);
  });
});

describe('quadrantOf', () => {
  it('classifies the four quadrants', () => {
    expect(quadrantOf(8, -3).id).toBe('I'); // high energy, negative
    expect(quadrantOf(8, 3).id).toBe('II'); // high energy, positive (optimal)
    expect(quadrantOf(2, -3).id).toBe('III'); // low energy, negative
    expect(quadrantOf(2, 3).id).toBe('IV'); // low energy, positive
  });

  it('treats energy 5 as high and emotion 0 as positive (boundaries)', () => {
    expect(quadrantOf(5, 0).id).toBe('II');
  });

  it('marks only quadrant II as optimal', () => {
    expect(quadrantOf(9, 4).optimal).toBe(true);
    expect(quadrantOf(9, -4).optimal).toBe(false);
  });
});

describe('readingsForDay', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const base = 1000 * DAY;
  const mk = (id: string, time: number): CheckinRecord => ({
    id,
    createdAt: 0,
    time,
    energy: 5,
    emotion: 0,
  });

  it('returns only the given day’s readings, oldest-first', () => {
    const checkins = [
      mk('a', base + 9 * 60 * 60 * 1000),
      mk('b', base + 2 * 60 * 60 * 1000),
      mk('c', base - DAY), // previous day
    ];
    const result = readingsForDay(checkins, base + DAY / 2);
    expect(result.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
