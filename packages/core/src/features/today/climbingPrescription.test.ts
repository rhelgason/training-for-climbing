import type { ClimbRecord } from '../../db/types';
import {
  CONSOLIDATED_SENDS,
  PYRAMID_WINDOW_DAYS,
  formatBands,
  prescribeClimbing,
} from './climbingPrescription';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);

function climb(
  grade: string,
  daysAgo: number,
  outcome: ClimbRecord['outcome'] = 'send',
): ClimbRecord {
  return {
    id: `c-${grade}-${daysAgo}-${outcome}`,
    createdAt: NOW - daysAgo * MS_PER_DAY,
    updatedAt: NOW - daysAgo * MS_PER_DAY,
    date: NOW - daysAgo * MS_PER_DAY,
    environment: 'indoor',
    discipline: 'boulder',
    grade,
    outcome,
  };
}

/** `n` sends of a grade, spread over recent days. */
function sends(grade: string, n: number, startDaysAgo = 5): ClimbRecord[] {
  return Array.from({ length: n }, (_, i) => climb(grade, startDaysAgo + i * 3));
}

describe('prescribeClimbing', () => {
  it('says so plainly when there is nothing logged', () => {
    const p = prescribeClimbing([], 'boulder', 'skill', NOW);
    expect(p.confidence).toBe('none');
    expect(p.anchor).toBeNull();
    expect(p.bands).toEqual({ warmUp: null, volume: null, work: null, project: null });
    expect(p.because).toMatch(/no sends logged/i);
  });

  it('anchors on the hardest consolidated grade, not the hardest single send', () => {
    // One lucky V6 must not pitch the whole session at V6.
    const climbs = [...sends('V4', CONSOLIDATED_SENDS), climb('V6', 4)];
    const p = prescribeClimbing(climbs, 'boulder', 'maxStrength', NOW);
    expect(p.anchor).toBe('V4');
    expect(p.confidence).toBe('established');
    expect(p.bands).toEqual({ warmUp: 'V1', volume: 'V3', work: 'V5', project: 'V6' });
  });

  it('falls back to the hardest send when nothing is consolidated, flagged provisional', () => {
    const p = prescribeClimbing([climb('V5', 3), climb('V3', 9)], 'boulder', 'skill', NOW);
    expect(p).toMatchObject({ anchor: 'V5', confidence: 'provisional' });
    expect(p.because).toMatch(/starting point/i);
  });

  it('ignores sends outside the window', () => {
    const climbs = [
      ...sends('V2', CONSOLIDATED_SENDS),
      ...sends('V6', CONSOLIDATED_SENDS, PYRAMID_WINDOW_DAYS + 10),
    ];
    expect(prescribeClimbing(climbs, 'boulder', 'skill', NOW).anchor).toBe('V2');
  });

  it('ignores attempts that were not sends', () => {
    const climbs = [...sends('V3', CONSOLIDATED_SENDS), climb('V8', 2, 'attempt')];
    expect(prescribeClimbing(climbs, 'boulder', 'skill', NOW).anchor).toBe('V3');
  });

  it('ignores the other discipline', () => {
    const routes = [...sends('V4', CONSOLIDATED_SENDS)].map((c) => ({
      ...c,
      discipline: 'boulder' as const,
    }));
    const p = prescribeClimbing(routes, 'lead', 'skill', NOW);
    expect(p.confidence).toBe('none');
  });

  it('clamps bands at the ends of the scale instead of inventing grades', () => {
    const p = prescribeClimbing(sends('VB', CONSOLIDATED_SENDS), 'boulder', 'skill', NOW);
    expect(p.anchor).toBe('VB');
    expect(p.bands.warmUp).toBeNull(); // nothing three grades below VB
    expect(p.bands.volume).toBeNull(); // nor one below it
    expect(p.bands.work).toBe('V0'); // VB is the bottom of the scale, so +1 is V0
  });

  it('describes the style the focus calls for, and always says something', () => {
    expect(prescribeClimbing([], 'boulder', 'power', NOW).style).toMatch(/explosive/i);
    expect(prescribeClimbing([], 'boulder', 'enduranceAerobic', NOW).style).toMatch(/mileage/i);
    expect(prescribeClimbing([], 'boulder', null, NOW).style).toBeTruthy();
  });

  it('works on the route scale too', () => {
    const routes = sends('5.11a', CONSOLIDATED_SENDS).map((c) => ({
      ...c,
      discipline: 'lead' as const,
    }));
    const p = prescribeClimbing(routes, 'lead', 'powerEndurance', NOW);
    expect(p.anchor).toBe('5.11a');
    expect(p.bands.work).toBe('5.11b');
  });
});

describe('formatBands', () => {
  it('joins the bands that exist', () => {
    expect(formatBands({ warmUp: 'V1', volume: 'V3', work: 'V5', project: 'V6' })).toBe(
      'warm up V1 · volume V3 · work V5 · project V6',
    );
  });

  it('skips missing bands', () => {
    expect(formatBands({ warmUp: null, volume: null, work: 'V1', project: 'V2' })).toBe(
      'work V1 · project V2',
    );
  });
});
