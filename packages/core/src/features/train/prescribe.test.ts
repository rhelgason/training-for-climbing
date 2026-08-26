import { TRACKABLE_PROTOCOLS, protocolById } from '../../content/protocols';
import type { BenchmarkRecord } from '../../db/types';
import { FRESH_DAYS } from './baseline';
import { prescribeProtocol } from './prescribe';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);
const HANG = 'protocol-max-weight-hang';

function record(value: number, daysAgo: number, testId = HANG): BenchmarkRecord {
  return {
    id: `b-${daysAgo}-${value}`,
    createdAt: NOW - daysAgo * MS_PER_DAY,
    testId,
    value,
    date: NOW - daysAgo * MS_PER_DAY,
  };
}

describe('prescribeProtocol', () => {
  it('prescribes a test session when there is no baseline', () => {
    const p = prescribeProtocol(HANG, [], NOW);
    expect(p).toMatchObject({ kind: 'test', target: null, confidence: 'none' });
    expect(p?.text).toMatch(/establish your baseline/i);
    expect(p?.dosage).toMatch(/form breaks/i);
  });

  it('prescribes 90% of an established baseline, rounded to the protocol step', () => {
    // Best-of-two is 30; 90% is 27, which rounds down to 25 on a 5 lb step.
    const p = prescribeProtocol(HANG, [record(30, 4), record(28, 10)], NOW);
    expect(p).toMatchObject({ kind: 'work', target: 25, confidence: 'established' });
    expect(p?.targetLabel).toBe('+25 lb');
    expect(p?.text).toContain('5 sets · 10 s hang · 3 min rest');
  });

  it('holds a single unconfirmed session to a lighter fraction', () => {
    const established = prescribeProtocol(HANG, [record(50, 3), record(50, 9)], NOW);
    const provisional = prescribeProtocol(HANG, [record(50, 3)], NOW);
    expect(provisional?.confidence).toBe('provisional');
    expect(provisional!.target!).toBeLessThan(established!.target!);
  });

  it('holds stale data back further and asks for a retest', () => {
    const p = prescribeProtocol(HANG, [record(50, FRESH_DAYS + 20)], NOW);
    expect(p?.confidence).toBe('stale');
    expect(p?.target).toBe(40); // 80% of 50
    expect(p?.because).toMatch(/retest/i);
  });

  it('never prescribes above the climber’s own logged best', () => {
    // The invariant that matters: whatever the percentages and rounding do, the
    // app must not ask for a load they have never actually held.
    for (const value of [1, 3, 5, 7, 12, 23, 47, 100]) {
      for (const daysAgo of [1, 20, FRESH_DAYS + 5]) {
        const p = prescribeProtocol(HANG, [record(value, daysAgo)], NOW);
        if (p?.kind !== 'work') continue;
        expect(p.target!).toBeLessThanOrEqual(value);
      }
    }
  });

  it('never rounds a target up', () => {
    const protocol = protocolById(HANG)!;
    for (const value of [11, 13, 17, 19, 29, 31]) {
      const p = prescribeProtocol(HANG, [record(value, 2)], NOW);
      expect(p!.target! % protocol.step).toBe(0);
      expect(p!.target!).toBeLessThanOrEqual(value);
    }
  });

  it('gives repeaters a level rather than a weight', () => {
    const p = prescribeProtocol(
      'protocol-repeaters-level',
      [record(3, 5, 'protocol-repeaters-level')],
      NOW,
    );
    expect(p?.kind).toBe('work');
    expect(p?.targetLabel).toMatch(/^L\d$/);
    expect(p?.dosage).toMatch(/7 s on \/ 3 s off/);
  });

  it('gives cardio dosage guidance and no number to chase', () => {
    const p = prescribeProtocol(
      'protocol-arc-minutes',
      [record(1800, 3, 'protocol-arc-minutes')],
      NOW,
    );
    expect(p).toMatchObject({ kind: 'general', target: null, targetLabel: null });
    expect(p?.text).toMatch(/RPE 4–6/);
  });

  it('refuses to prescribe barbell work at all', () => {
    // The app tracks these numbers but does not tell anyone what to lift.
    expect(
      prescribeProtocol('protocol-deadlift', [record(225, 3, 'protocol-deadlift')], NOW),
    ).toBeNull();
    expect(prescribeProtocol('protocol-squat', [record(185, 3, 'protocol-squat')], NOW)).toBeNull();
  });

  it('returns null for every protocol the plan is not allowed to prescribe', () => {
    for (const protocol of TRACKABLE_PROTOCOLS) {
      const result = prescribeProtocol(protocol.id, [], NOW);
      if (protocol.prescription === 'track') {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
      }
    }
  });

  it('returns null for an unknown protocol', () => {
    expect(prescribeProtocol('protocol-nope', [], NOW)).toBeNull();
  });
});
