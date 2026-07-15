import type { AssessmentRecord, ClimbRecord } from '../../db/types';
import type { ClimbDiscipline, ClimbEnvironment, ClimbOutcome } from '../../content/climbing';
import {
  countInLastDays,
  firstTryRate,
  hardestSend,
  monthlyCounts,
  sendPyramid,
  sendRate,
  triadSeries,
  weeklyCounts,
} from './dashboard';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

function climb(
  partial: Partial<ClimbRecord> & {
    discipline: ClimbDiscipline;
    grade: string;
    outcome: ClimbOutcome;
  },
): ClimbRecord {
  return {
    id: partial.id ?? `${partial.grade}-${partial.outcome}`,
    createdAt: 0,
    updatedAt: 0,
    date: partial.date ?? NOW,
    environment: partial.environment ?? ('indoor' as ClimbEnvironment),
    ...partial,
  };
}

describe('hardestSend', () => {
  it('returns the highest-ranked sent climb of a discipline', () => {
    const climbs = [
      climb({ discipline: 'boulder', grade: 'V3', outcome: 'send' }),
      climb({ discipline: 'boulder', grade: 'V6', outcome: 'flash' }),
      climb({ discipline: 'boulder', grade: 'V8', outcome: 'attempt' }), // not a send
      climb({ discipline: 'lead', grade: '5.12a', outcome: 'send' }),
    ];
    expect(hardestSend(climbs, 'boulder')?.grade).toBe('V6');
  });

  it('returns null when there are no sends in that discipline', () => {
    expect(
      hardestSend([climb({ discipline: 'boulder', grade: 'V5', outcome: 'attempt' })], 'boulder'),
    ).toBeNull();
    expect(hardestSend([], 'lead')).toBeNull();
  });
});

describe('sendPyramid', () => {
  it('counts sent grades hardest-first', () => {
    const climbs = [
      climb({ id: '1', discipline: 'boulder', grade: 'V2', outcome: 'send' }),
      climb({ id: '2', discipline: 'boulder', grade: 'V2', outcome: 'flash' }),
      climb({ id: '3', discipline: 'boulder', grade: 'V4', outcome: 'send' }),
      climb({ id: '4', discipline: 'boulder', grade: 'V4', outcome: 'attempt' }), // excluded
    ];
    expect(sendPyramid(climbs, 'boulder')).toEqual([
      { grade: 'V4', count: 1 },
      { grade: 'V2', count: 2 },
    ]);
  });
});

describe('rates', () => {
  it('sendRate is sends over total', () => {
    const climbs = [
      climb({ discipline: 'lead', grade: '5.10a', outcome: 'send' }),
      climb({ discipline: 'lead', grade: '5.10b', outcome: 'attempt' }),
    ];
    expect(sendRate(climbs)).toBe(0.5);
    expect(sendRate([])).toBe(0);
  });

  it('firstTryRate is onsight/flash over sends', () => {
    const climbs = [
      climb({ id: 'a', discipline: 'boulder', grade: 'V1', outcome: 'flash' }),
      climb({ id: 'b', discipline: 'boulder', grade: 'V1', outcome: 'send' }),
    ];
    expect(firstTryRate(climbs)).toBe(0.5);
    expect(firstTryRate([])).toBe(0);
  });
});

describe('countInLastDays', () => {
  it('counts timestamps within the window', () => {
    const ts = [NOW, NOW - 5 * DAY, NOW - 40 * DAY];
    expect(countInLastDays(ts, NOW, 30)).toBe(2);
  });
});

describe('monthlyCounts', () => {
  it('buckets timestamps into the last N calendar months, oldest-first', () => {
    // Anchor at a mid-month moment to avoid boundary ambiguity.
    const now = new Date(2026, 5, 15).getTime(); // Jun 15, 2026
    const thisMonth = new Date(2026, 5, 2).getTime();
    const lastMonth = new Date(2026, 4, 10).getTime();
    const buckets = monthlyCounts([thisMonth, thisMonth, lastMonth], now, 3);
    expect(buckets).toHaveLength(3);
    expect(buckets[buckets.length - 1].count).toBe(2); // current month
    expect(buckets[buckets.length - 2].count).toBe(1); // previous month
    expect(buckets[0].count).toBe(0); // two months ago
  });
});

describe('weeklyCounts', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('buckets timestamps into the last N rolling 7-day windows, oldest-first', () => {
    const now = 1000 * DAY + DAY / 2;
    const thisWeek = [now - 1 * DAY, now - 3 * DAY]; // 2 in the most recent window
    const lastWeek = [now - 9 * DAY]; // 1 in the prior window
    const buckets = weeklyCounts([...thisWeek, ...lastWeek], now, 4);
    expect(buckets).toHaveLength(4);
    expect(buckets[buckets.length - 1].count).toBe(2); // current week
    expect(buckets[buckets.length - 2].count).toBe(1); // previous week
    expect(buckets[0].count).toBe(0); // oldest window
  });
});

describe('triadSeries', () => {
  it('returns triad scores oldest-first', () => {
    const a = (id: string, createdAt: number, mental: number): AssessmentRecord => ({
      id,
      createdAt,
      responses: {},
      mental,
      technical: 30,
      physical: 30,
      weakestArea: 'mental',
    });
    const series = triadSeries([a('2', 2000, 40), a('1', 1000, 35)]);
    expect(series.map((p) => p.mental)).toEqual([35, 40]);
  });
});
