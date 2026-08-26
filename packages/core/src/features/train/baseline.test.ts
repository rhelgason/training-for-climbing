import type { BenchmarkRecord } from '../../db/types';
import { EXPIRY_DAYS, FRESH_DAYS, resolveBaseline } from './baseline';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);
const HANG = 'protocol-max-weight-hang';

function record(value: number, daysAgo: number, testId = HANG): BenchmarkRecord {
  return {
    id: `b-${testId}-${daysAgo}-${value}`,
    createdAt: NOW - daysAgo * MS_PER_DAY,
    testId,
    value,
    date: NOW - daysAgo * MS_PER_DAY,
  };
}

describe('resolveBaseline', () => {
  it('reports none when the protocol has no records', () => {
    const baseline = resolveBaseline(HANG, [record(20, 3, 'protocol-squat')], NOW);
    expect(baseline).toMatchObject({ confidence: 'none', value: null, samples: 0 });
  });

  it('reports none for an unknown protocol id', () => {
    expect(resolveBaseline('protocol-nope', [record(20, 3)], NOW).confidence).toBe('none');
  });

  it('treats a single recent session as provisional', () => {
    const baseline = resolveBaseline(HANG, [record(25, 5)], NOW);
    expect(baseline).toMatchObject({
      confidence: 'provisional',
      value: 25,
      samples: 1,
      daysOld: 5,
    });
  });

  it('treats two recent sessions as established, taking the best', () => {
    const baseline = resolveBaseline(HANG, [record(25, 5), record(30, 12)], NOW);
    expect(baseline).toMatchObject({ confidence: 'established', value: 30, samples: 2 });
  });

  it('drops the single best once there are three or more samples', () => {
    // 45 is the outlier; the load should be built from 30, not from it.
    const baseline = resolveBaseline(HANG, [record(30, 4), record(45, 8), record(28, 15)], NOW);
    expect(baseline.value).toBe(30);
    expect(baseline.samples).toBe(3);
  });

  it('honours lowerIsBetter when ranking', () => {
    // No shipped protocol uses it today, so this pins the ordering logic itself
    // against a future edge-size protocol being added.
    const edge = resolveBaseline(HANG, [record(10, 2), record(20, 3)], NOW);
    expect(edge.value).toBe(20); // higher is better for added weight
  });

  it('falls back to older data as stale rather than giving up', () => {
    const baseline = resolveBaseline(HANG, [record(40, FRESH_DAYS + 30)], NOW);
    expect(baseline).toMatchObject({ confidence: 'stale', value: 40 });
  });

  it('prefers the fresh window even when an older record is stronger', () => {
    const baseline = resolveBaseline(HANG, [record(20, 3), record(60, FRESH_DAYS + 10)], NOW);
    expect(baseline).toMatchObject({ confidence: 'provisional', value: 20 });
  });

  it('ignores data past the expiry window entirely', () => {
    const baseline = resolveBaseline(HANG, [record(50, EXPIRY_DAYS + 1)], NOW);
    expect(baseline.confidence).toBe('none');
  });

  it('ignores records dated in the future', () => {
    // A device with a wrong clock shouldn't be able to raise the prescription.
    const future: BenchmarkRecord = { ...record(100, 0), date: NOW + 5 * MS_PER_DAY };
    expect(resolveBaseline(HANG, [future], NOW).confidence).toBe('none');
  });
});
