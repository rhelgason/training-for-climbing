import type { AssessmentRecord } from '../../db/types';
import { daysSinceLastAssessment, reassessDue } from './reassessment';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function assessment(daysAgo: number): AssessmentRecord {
  return {
    id: `a${daysAgo}`,
    createdAt: NOW - daysAgo * DAY,
    responses: {},
    mental: 40,
    technical: 30,
    physical: 50,
    weakestArea: 'technical',
  };
}

describe('daysSinceLastAssessment', () => {
  it('returns null when no assessment exists', () => {
    expect(daysSinceLastAssessment([], NOW)).toBeNull();
  });

  it('counts whole days since the most recent assessment', () => {
    expect(daysSinceLastAssessment([assessment(10), assessment(40)], NOW)).toBe(10);
  });
});

describe('reassessDue', () => {
  it('is false when no assessment has ever been taken', () => {
    expect(reassessDue([], NOW, 8)).toBe(false);
  });

  it('is false before the cadence elapses', () => {
    expect(reassessDue([assessment(55)], NOW, 8)).toBe(false); // 55 < 56 days
  });

  it('is true once the cadence (in weeks) has elapsed', () => {
    expect(reassessDue([assessment(56)], NOW, 8)).toBe(true); // 56 == 8*7
    expect(reassessDue([assessment(90)], NOW, 8)).toBe(true);
  });

  it('honours a custom cadence', () => {
    expect(reassessDue([assessment(28)], NOW, 4)).toBe(true); // 4*7
    expect(reassessDue([assessment(27)], NOW, 4)).toBe(false);
  });
});
