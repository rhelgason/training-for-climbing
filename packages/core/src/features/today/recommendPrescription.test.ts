/**
 * The prescription layer as the daily plan actually sees it — the wiring
 * between benchmarks, the send pyramid, and the steps a climber reads.
 * `recommend.test.ts` covers the scheduler's verdicts; this covers the numbers.
 */
import { EQUIPMENT_IDS } from '../../content/trainingContext';
import type { BenchmarkRecord, ClimbRecord, ExerciseLogRecord } from '../../db/types';
import { buildDailyRecommendation, dailyRecommendationFrom, type DailyInput } from './recommend';
import { buildFocusSteps } from './sessionPlan';

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
 * Sweep a run of days and collect every step the scheduler emits that carries
 * a workout or a protocol. Which focus lands on which day is the scheduler's
 * business, so pinning one day would be brittle — and a test that quietly
 * finds nothing to assert on is worse than no test. Each sweep asserts it
 * actually saw the case first.
 */
function sweep(
  days: number,
  overrides: Partial<DailyInput> = {},
  /** Takes `nowMs` because the sweep walks forward in time; fixtures stay relative. */
  extraFor?: (nowMs: number) => Partial<DailyInput>,
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
      ...(extraFor ? extraFor(nowMs) : {}),
    });
    for (const step of plan.steps) if (step.protocolId || step.workoutId) steps.push(step);
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

function hangLog(nowMs: number, loadLb: number, rpe: number, daysAgo = 3): ExerciseLogRecord {
  const date = nowMs - daysAgo * MS_PER_DAY;
  return {
    id: `l-${nowMs}`,
    createdAt: date,
    updatedAt: date,
    date,
    workoutId: 'max-hang-10',
    edgeMm: 20,
    sets: [1, 2, 3].map(() => ({ loadLb, rpe, completed: true, reps: 5 })),
  };
}

describe('daily plan — workout targets', () => {
  it('makes fingerboard work a test session when nothing is logged', () => {
    const hangs = sweep(40).filter((s) =>
      [
        'max-hang-10',
        'max-hang-7-53',
        'min-edge-hangs',
        'repeaters-short',
        'repeaters-long',
      ].includes(s.workoutId ?? ''),
    );
    expect(hangs.length).toBeGreaterThan(0);
    for (const step of hangs) {
      expect(step.target?.kind).toBe('test');
      expect(step.text).toMatch(/Today finds your number/);
    }
  });

  it('starts from an older benchmark before anything is logged set by set', () => {
    const steps = sweep(40, {}, (n) => ({ benchmarks: [relative(40, 5)(n), relative(38, 12)(n)] }));
    const hangs = steps.filter((s) => s.workoutId === 'max-hang-10');
    expect(hangs.length).toBeGreaterThan(0);
    for (const step of hangs) {
      expect(step.target?.kind).toBe('hold');
      expect(step.target?.loadLb).toBe(40);
      expect(step.text).toContain('+40 lb');
    }
  });

  it('adds a step once the logged sets were clean and comfortable', () => {
    const steps = sweep(40, {}, (n) => ({ exerciseLogs: [hangLog(n, 25, 8)] }));
    const hangs = steps.filter((s) => s.workoutId === 'max-hang-10');
    expect(hangs.length).toBeGreaterThan(0);
    for (const step of hangs) {
      expect(step.target?.kind).toBe('progress');
      expect(step.text).toMatch(/^Max strength — Max-weight hangs \(10 s\): \+30 lb/);
      expect(step.text).toMatch(/Last time \(3 days ago\): \+25 lb/);
    }
  });

  it('judges ARC by feel', () => {
    const arc = sweep(40).filter((s) => s.workoutId === 'arc');
    expect(arc.length).toBeGreaterThan(0);
    for (const step of arc) expect(step.target?.kind).toBe('feel');
  });

  it('leaves lifting as a number the climber chooses', () => {
    const steps = buildFocusSteps(
      'conditioning',
      {
        dayIdx: 0,
        equipment: [...EQUIPMENT_IDS],
        benchmarks: [relative(225, 3, 'protocol-deadlift')(NOW)],
        nowMs: NOW,
        abilityTier: 'intermediate',
        sessionLength: 'standard',
        climbing: null,
        injury: null,
      },
      'primary',
    );
    const lift = steps.find((s) => s.protocolId === 'protocol-deadlift');
    expect(lift).toBeDefined();
    expect(lift!.workoutId).toBeUndefined();
    expect(lift!.target).toBeUndefined();
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
    const plan = dailyRecommendationFrom({
      weakestArea: 'physical',
      goals: [],
      trainingDates: [],
      nowMs: NOW,
      journals: [],
      climbs,
    });
    expect(plan.climbing?.anchor).toBe('V3');
  });
});
