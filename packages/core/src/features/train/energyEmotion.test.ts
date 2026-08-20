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

  // Built from local wall-clock times: "today" is the climber's calendar day,
  // so an evening reading belongs to the day they think it does.
  const at = (dayOffset: number, hour: number) => new Date(2026, 7, 20 + dayOffset, hour).getTime();

  it('returns only the given day’s readings, oldest-first', () => {
    const checkins = [
      mk('a', at(0, 9)),
      mk('b', at(0, 2)),
      mk('c', at(-1, 9)), // previous day
    ];
    expect(readingsForDay(checkins, at(0, 12)).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('keeps an evening reading on the same day as a morning one', () => {
    const checkins = [mk('morning', at(0, 8)), mk('evening', at(0, 21))];
    expect(readingsForDay(checkins, at(0, 8)).map((r) => r.id)).toEqual(['morning', 'evening']);
  });
});
