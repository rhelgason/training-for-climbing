/**
 * The prescription layer as the daily plan actually sees it — the wiring
 * between benchmarks, the send pyramid, and the steps a climber reads.
 * `recommend.test.ts` covers the scheduler's verdicts; this covers the numbers.
 */
import type { BenchmarkRecord, ClimbRecord } from '../../db/types';
import { buildDailyRecommendation, type DailyInput } from './recommend';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);
const HANG = 'protocol-max-weight-hang';

function climb(grade: string, daysAgo: number): ClimbRecord {
  return {
    id: `c-${grade}-${daysAgo}`,
    createdAt: NOW - daysAgo * MS_PER_DAY,
    updatedAt: NOW - daysAgo * MS_PER_DAY,
    date: NOW - daysAgo * MS_PER_DAY,
    environment: 'indoor',
    discipline: 'boulder',
    grade,
    outcome: 'send',
  };
}

/** A plan on a day the scheduler will allow training. */
function planFor(overrides: Partial<DailyInput> = {}) {
  return buildDailyRecommendation({
    weakestArea: 'physical',
    goals: [],
    trainingDates: [NOW - 4 * MS_PER_DAY],
    nowMs: NOW,
    abilityTier: 'intermediate',
    daysPerWeek: 4,
    ...overrides,
  });
}

/**
 * Sweep a run of days and collect every prescribable step the scheduler emits.
 * Which focus lands on which day is the scheduler's business, so pinning one
 * day would be brittle — and a test that quietly finds nothing to assert on is
 * worse than no test. Each sweep asserts it actually saw the case first.
 */
function sweep(
  days: number,
  overrides: Partial<DailyInput> = {},
  /**
   * Benchmarks for the simulated day. Takes `nowMs` because the sweep walks
   * forward in time: fixtures pinned to a fixed date would silently age into
   * `stale` partway through and change the intensity out from under the test.
   */
  benchmarksFor?: (nowMs: number) => BenchmarkRecord[],
) {
  const steps = [];
  for (let d = 0; d < days; d++) {
    const nowMs = NOW + d * MS_PER_DAY;
    const plan = buildDailyRecommendation({
      weakestArea: 'physical',
      goals: [],
      trainingDates: [nowMs - 4 * MS_PER_DAY],
      nowMs,
      abilityTier: 'intermediate',
      daysPerWeek: 4,
      history: [],
      ...overrides,
      ...(benchmarksFor ? { benchmarks: benchmarksFor(nowMs) } : {}),
    });
    for (const step of plan.steps) if (step.protocolId) steps.push(step);
  }
  return steps;
}

/** A benchmark `daysAgo` before the given day, rather than before a fixed NOW. */
function relative(value: number, daysAgo: number, testId = HANG) {
  return (nowMs: number): BenchmarkRecord => ({
    id: `b-${testId}-${daysAgo}-${value}`,
    createdAt: nowMs - daysAgo * MS_PER_DAY,
    testId,
    value,
    date: nowMs - daysAgo * MS_PER_DAY,
  });
}

const EXACT = [
  'protocol-max-weight-hang',
  'protocol-repeaters-level',
  'protocol-moving-hang-seconds',
];
const TRACK = ['protocol-pullup-reps', 'protocol-weighted-pullup', 'protocol-deadlift'];

describe('daily plan — protocol prescriptions', () => {
  it('prescribes a test session for fingerboard work when no baseline exists', () => {
    const exact = sweep(40).filter((s) => EXACT.includes(s.protocolId!));
    expect(exact.length).toBeGreaterThan(0);
    for (const step of exact) {
      expect(step.prescription?.kind).toBe('test');
      expect(step.prescription?.target).toBeNull();
      expect(step.text).toMatch(/establish your baseline/i);
    }
  });

  it('puts the number into the step text once a baseline exists', () => {
    const steps = sweep(40, {}, (n) => [relative(40, 5)(n), relative(38, 12)(n)]);
    const hangs = steps.filter((s) => s.protocolId === HANG);
    expect(hangs.length).toBeGreaterThan(0);
    for (const step of hangs) {
      expect(step.prescription?.kind).toBe('work');
      // 90% of the best of two recent sessions (40), rounded down to a 5 lb step.
      expect(step.prescription?.target).toBe(35);
      expect(step.text).toContain('+35 lb');
      expect(step.text).toContain('5 sets · 10 s hang · 3 min rest');
    }
  });

  it('never prescribes a load above what was actually logged', () => {
    for (const best of [7, 22, 41, 95]) {
      const hangs = sweep(20, {}, (n) => [relative(best, 4)(n)]).filter(
        (s) => s.protocolId === HANG,
      );
      for (const step of hangs) expect(step.prescription!.target!).toBeLessThanOrEqual(best);
    }
  });

  it('gives cardio guidance without a number to chase', () => {
    const arc = sweep(40).filter((s) => s.protocolId === 'protocol-arc-minutes');
    expect(arc.length).toBeGreaterThan(0);
    for (const step of arc) {
      expect(step.prescription?.kind).toBe('general');
      expect(step.prescription?.target).toBeNull();
    }
  });

  it('never attaches a prescription to lifting or the other tracked protocols', () => {
    const tracked = sweep(40, {}, (n) => [
      relative(225, 3, 'protocol-deadlift')(n),
      relative(12, 3, 'protocol-pullup-reps')(n),
    ]).filter((s) => TRACK.includes(s.protocolId!));
    expect(tracked.length).toBeGreaterThan(0);
    for (const step of tracked) expect(step.prescription).toBeUndefined();
  });
});

describe('daily plan — climbing grades', () => {
  it('pitches grades against the send pyramid on a training day', () => {
    const climbs = [climb('V4', 5), climb('V4', 9), climb('V4', 14), climb('V6', 7)];
    const plan = planFor({ climbs, history: [] });
    expect(plan.kind).toBe('train');
    expect(plan.climbing).not.toBeNull();
    // Anchored on the consolidated V4, not the one-off V6.
    expect(plan.climbing!.anchor).toBe('V4');
    expect(plan.climbing!.bands.work).toBe('V5');
    expect(plan.climbing!.confidence).toBe('established');
  });

  it('admits it has nothing to go on before any climbs are logged', () => {
    const plan = planFor({ history: [] });
    expect(plan.climbing?.confidence).toBe('none');
    expect(plan.climbing?.bands.work).toBeNull();
  });

  it('prescribes no grades on a rest day', () => {
    // Three hard days running forces rest whatever else is true.
    const recent = [1, 2, 3].map((d) => NOW - d * MS_PER_DAY);
    const plan = buildDailyRecommendation({
      weakestArea: 'physical',
      goals: [],
      trainingDates: recent,
      nowMs: NOW,
      journals: undefined as never,
      climbs: [climb('V4', 5), climb('V4', 9), climb('V4', 14)],
    } as DailyInput);
    expect(plan.kind).toBe('rest');
    expect(plan.climbing).toBeNull();
  });

  it('prescribes no grades before the self-assessment is taken', () => {
    const plan = planFor({ weakestArea: null, climbs: [climb('V4', 5)] });
    expect(plan.kind).toBe('assess');
    expect(plan.climbing).toBeNull();
  });

  it('uses the route scale when the climber is a route climber', () => {
    const routes = [1, 2, 3].map((i) => ({
      ...climb('5.11a', i * 4),
      discipline: 'lead' as const,
    }));
    const plan = planFor({ climbs: routes, discipline: 'lead', history: [] });
    expect(plan.climbing?.anchor).toBe('5.11a');
  });

  it('flows through the journals/climbs convenience wrapper', () => {
    // dailyRecommendationFrom takes climbs for load classification; they should
    // reach the grade prescription too rather than being dropped on the floor.
    const climbs = [climb('V3', 5), climb('V3', 9), climb('V3', 14)];
    const plan = buildDailyRecommendation({
      weakestArea: 'physical',
      goals: [],
      trainingDates: [],
      nowMs: NOW,
      climbs,
      history: [],
    });
    expect(plan.climbing?.anchor).toBe('V3');
  });
});
