/**
 * Progression — reading the training notebook to decide today's number.
 *
 * Hörst's rule is progressive overload: keep the protocol fixed and move one
 * number when the sets stop being hard. This reads the logged sets for one
 * workout and says, in one line, what last time was and what today is:
 * "Last time +25 lb, all 10 hangs clean at RPE 8 → today +30 lb."
 *
 * The rules, per session (newest first):
 *
 *  - **Pain** → back off a step, and say so. The book: stop at the first twinge.
 *  - **Every set clean, top RPE at least half a point under the target** →
 *    progress a step.
 *  - **Clean at the target RPE twice running at the same number** → progress.
 *    One hard-but-clean day earns a repeat; two earn the step.
 *  - **Clean but over the target RPE** → hold.
 *  - **Failed sets** → hold. Failing twice running, or half the sets, → back off.
 *  - **Last session over 6 weeks old** → back off a step; over 6 months → retest.
 *  - **Three sessions with no gain** → flag a stall and suggest the book's
 *    variation for that protocol.
 *
 * A step means the workout's own unit: +5 lb, a 2 mm smaller edge, one
 * repeater level, one pull-up per interval, one more set. At the top of a
 * range the workout's `ceiling` says what the book does next.
 */
import { protocolById } from '../../content/protocols';
import { GRIP_LABELS, type Workout, workoutById, type WorkoutMetric } from '../../content/workouts';
import type { BenchmarkRecord, ExerciseLogRecord, GripId, SetLog } from '../../db/types';
import { resolveBaseline } from './baseline';

const DAY_MS = 24 * 60 * 60 * 1000;
/** After this long away, start a step lighter. */
export const DETRAIN_DAYS = 42;
/** After this long away, the old number means little; measure again. */
export const RETEST_DAYS = 180;
/** Sessions without improvement before calling it a stall. */
export const STALL_SESSIONS = 3;

export type TargetKind =
  /** No usable history: today measures. */
  | 'test'
  /** Up a step. */
  | 'progress'
  /** Same number again. */
  | 'hold'
  /** Down a step. */
  | 'backoff'
  /** Judged by feel; no number to chase. */
  | 'feel';

export type SessionOutcome = 'pain' | 'easy' | 'solid' | 'maxed' | 'failed' | 'unrated';

export interface SessionSummary {
  log: ExerciseLogRecord;
  outcome: SessionOutcome;
  /** The workout's metric for this session (load, edge, level, …). */
  value: number | null;
  cleanSets: number;
  totalSets: number;
  topRpe: number | null;
}

export interface WorkoutTarget {
  workoutId: string;
  kind: TargetKind;
  sets: number;
  loadLb?: number;
  edgeMm?: number;
  level?: number;
  reps?: number;
  grade?: string;
  grip?: GripId;
  /** Today's target in one line: "+30 lb · 20 mm half crimp · 3 sets". */
  label: string;
  /** "Last time … → today …". */
  because: string;
  /** Book advice at a ceiling, after pain, or on a stall. */
  advice?: string;
  stalled: boolean;
  /** Days since the last logged session, or null when there is none. */
  daysSince: number | null;
  last?: SessionSummary;
}

/** Per-protocol variation when progress stalls (Ch 8: vary the stimulus). */
const STALL_SWAP: Record<string, string> = {
  'max-hang-10': 'max-hang-7-53',
  'max-hang-7-53': 'max-hang-10',
  'min-edge-hangs': 'max-hang-10',
  'repeaters-short': 'repeaters-long',
  'repeaters-long': 'repeaters-short',
  'hit-max': 'limit-bouldering',
  'limit-bouldering': 'hit-max',
  'weighted-pullups': 'one-arm-lockoffs',
  'campus-ladder': 'campus-power-ladder',
};

const isClean = (s: SetLog) => s.completed;

/** The metric's value for one session. */
export function sessionValue(workout: Workout, log: ExerciseLogRecord): number | null {
  const done = log.sets.filter(isClean);
  switch (workout.metric) {
    case 'load': {
      const pool = done.length > 0 ? done : log.sets;
      const loads = pool.map((s) => s.loadLb).filter((n): n is number => typeof n === 'number');
      return loads.length > 0 ? Math.max(...loads) : null;
    }
    case 'edge':
      return log.edgeMm ?? null;
    case 'level':
      return log.level ?? null;
    case 'reps': {
      if (!workout.logs.includes('reps')) return done.length || null;
      const reps = done.map((s) => s.reps).filter((n): n is number => typeof n === 'number');
      return reps.length > 0 ? Math.max(...reps) : null;
    }
    case 'sets':
      return done.length || null;
    case 'grade':
    case 'feel':
      return null;
  }
}

/** How a session went against the workout's target RPE. */
export function summarizeSession(workout: Workout, log: ExerciseLogRecord): SessionSummary {
  const totalSets = log.sets.length;
  const cleanSets = log.sets.filter(isClean).length;
  const rpes = log.sets.map((s) => s.rpe).filter((n): n is number => typeof n === 'number');
  const topRpe = rpes.length > 0 ? Math.max(...rpes) : null;
  // For set-count metrics every logged set is a done set; the outcome is about RPE.
  const allClean = totalSets > 0 && cleanSets === totalSets;

  let outcome: SessionOutcome;
  if (log.pain) outcome = 'pain';
  else if (totalSets === 0) outcome = 'unrated';
  else if (!allClean) outcome = 'failed';
  else if (topRpe === null) outcome = 'unrated';
  else if (topRpe <= workout.targetRpe - 0.5) outcome = 'easy';
  else if (topRpe <= workout.targetRpe + 0.5) outcome = 'solid';
  else outcome = 'maxed';

  return { log, outcome, value: sessionValue(workout, log), cleanSets, totalSets, topRpe };
}

/** One step harder (+1) or easier (−1), clamped. Returns null past the ceiling. */
function stepValue(workout: Workout, value: number, dir: 1 | -1): number | null {
  // A smaller edge is harder.
  const delta = workout.metric === 'edge' ? -workout.step * dir : workout.step * dir;
  const next = value + delta;
  if (dir === 1) {
    if (workout.metric === 'edge' && workout.min !== undefined && next < workout.min) return null;
    if (workout.metric !== 'edge' && workout.max !== undefined && next > workout.max) return null;
  }
  const lo = workout.metric === 'load' ? -Infinity : (workout.min ?? 0);
  const hi = workout.max ?? Infinity;
  return Math.min(hi, Math.max(lo, next));
}

export function formatLoad(lb: number): string {
  if (lb === 0) return 'bodyweight';
  return lb > 0 ? `+${lb} lb` : `${Math.abs(lb)} lb assist`;
}

export function formatMetric(metric: WorkoutMetric, value: number): string {
  switch (metric) {
    case 'load':
      return formatLoad(value);
    case 'edge':
      return `${value} mm`;
    case 'level':
      return `L${value}`;
    case 'reps':
      return `${value} reps`;
    case 'sets':
      return `${value} sets`;
    default:
      return String(value);
  }
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function ago(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** "+25 lb on 20 mm, 9/10 hangs clean, top RPE 9". */
export function describeSession(workout: Workout, s: SessionSummary): string {
  const bits: string[] = [];
  const { log } = s;
  if (workout.metric === 'load' && s.value !== null) bits.push(formatLoad(s.value));
  if (workout.metric === 'level' && log.level) bits.push(`L${log.level}`);
  if (log.edgeMm && workout.equipment.includes('hangboard')) bits.push(`on ${log.edgeMm} mm`);
  if (log.grade) bits.push(`at ${log.grade}`);
  const unit = 'set';
  if (workout.metric === 'reps' && s.value !== null && workout.logs.includes('reps')) {
    bits.push(`${s.value} per set`);
  }
  bits.push(
    s.cleanSets === s.totalSets
      ? `all ${plural(s.totalSets, unit)} clean`
      : `${s.cleanSets}/${s.totalSets} ${unit}s clean`,
  );
  if (s.topRpe !== null) bits.push(`top RPE ${s.topRpe}`);
  if (log.pain) bits.push('with pain');
  return bits.join(', ').replace(', on', ' on').replace(', at', ' at');
}

/** Today's target as a single line. */
export function formatTarget(
  workout: Workout,
  t: Omit<WorkoutTarget, 'label' | 'because'>,
): string {
  const bits: string[] = [];
  if (t.loadLb !== undefined && (workout.metric === 'load' || workout.logs.includes('load'))) {
    bits.push(formatLoad(t.loadLb));
  }
  if (t.level !== undefined) bits.push(`L${t.level}`);
  if (t.edgeMm !== undefined) {
    bits.push(t.grip ? `${t.edgeMm} mm ${GRIP_LABELS[t.grip].toLowerCase()}` : `${t.edgeMm} mm`);
  } else if (t.grip && !workout.gripPlan) {
    bits.push(GRIP_LABELS[t.grip].toLowerCase());
  }
  if (t.grade) bits.push(t.grade);
  const spec = workout.intervals?.({ sets: t.sets, level: t.level, reps: t.reps });
  if (spec && spec.repsPerSet > 1 && spec.sets > 1) {
    bits.push(`${t.sets} × ${spec.repsPerSet} × ${spec.workSec} s on / ${spec.restSec} s off`);
  } else if (workout.metric === 'reps' && t.reps !== undefined && workout.logs.includes('reps')) {
    bits.push(`${t.reps} per ${workout.id === 'pullup-intervals' ? 'minute × 20' : 'set'}`);
    if (workout.sets[0] !== workout.sets[1]) bits.push(plural(t.sets, 'set'));
  } else if (workout.metric === 'reps' && t.reps !== undefined) {
    bits.push(plural(t.reps, 'interval'));
  } else {
    bits.push(plural(t.sets, 'set'));
  }
  return bits.join(' · ');
}

const clampSets = (workout: Workout, n: number) =>
  Math.min(workout.sets[1], Math.max(workout.sets[0], n));

/** True when none of the last `STALL_SESSIONS` beat the session before them. */
function isStalled(workout: Workout, summaries: SessionSummary[]): boolean {
  if (summaries.length <= STALL_SESSIONS) return false;
  const recent = summaries.slice(0, STALL_SESSIONS).map((s) => s.value);
  const before = summaries[STALL_SESSIONS].value;
  if (before === null || recent.some((v) => v === null)) return false;
  const better = (a: number, b: number) => (workout.metric === 'edge' ? a < b : a > b);
  return !recent.some((v) => better(v as number, before));
}

/** A target before the shared fields (id, label, stall, age) are filled in. */
type TargetDraft = Omit<WorkoutTarget, 'label' | 'workoutId' | 'stalled' | 'daysSince'> & {
  stalled?: boolean;
};

export interface ProgressInput {
  /** This workout's logs, any order. */
  logs: ExerciseLogRecord[];
  nowMs: number;
  /** Older single-number benchmarks, used only when nothing is logged yet. */
  benchmarks?: BenchmarkRecord[];
}

/** Today's target for one workout. */
export function progressWorkout(workout: Workout, input: ProgressInput): WorkoutTarget {
  const logs = input.logs
    .filter((l) => l.workoutId === workout.id)
    .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
  const summaries = logs.map((l) => summarizeSession(workout, l));
  const last = summaries[0];
  const defaults = workout.defaults ?? {};
  const daysSince = last ? Math.floor((input.nowMs - last.log.date) / DAY_MS) : null;

  const finish = (t: TargetDraft): WorkoutTarget => {
    const base = { ...t, workoutId: workout.id, stalled: t.stalled ?? false, daysSince, last };
    return { ...base, label: formatTarget(workout, base) };
  };

  if (workout.metric === 'feel') {
    return finish({
      kind: 'feel',
      sets: last ? clampSets(workout, last.totalSets) : workout.sets[0],
      grip: defaults.grip,
      because: last
        ? `Last time ${ago(daysSince ?? 0)}: ${describeSession(workout, last)}. Judge this one by feel at RPE ${workout.targetRpe}.`
        : `Judged by feel — aim for RPE ${workout.targetRpe}.`,
    });
  }

  // ── No notebook entries yet ──
  if (!last || (last.value === null && workout.metric !== 'grade')) {
    return fromBenchmark(workout, input, finish);
  }

  const lastLine = `Last time (${ago(daysSince ?? 0)}): ${describeSession(workout, last)}`;
  const held = {
    edgeMm: last.log.edgeMm ?? defaults.edgeMm,
    grip: last.log.grip ?? defaults.grip,
    level: last.log.level ?? defaults.level,
    grade: last.log.grade,
  };
  const lastSets = clampSets(workout, last.totalSets || workout.sets[0]);

  // ── Grade: climbing sets don't step by arithmetic ──
  if (workout.metric === 'grade') {
    const allClean =
      last.outcome === 'easy' || last.outcome === 'solid' || last.outcome === 'unrated';
    return finish({
      kind: allClean && last.outcome !== 'unrated' ? 'progress' : 'hold',
      sets: lastSets,
      ...held,
      because: `${lastLine}.`,
      advice:
        last.outcome === 'pain'
          ? 'Pain last time — stay off the problem that caused it.'
          : last.outcome === 'easy' || last.outcome === 'solid'
            ? 'Every lap went. Swap one problem for one a grade harder.'
            : 'Same problems until every lap goes.',
    });
  }

  const value = last.value as number;
  const at = (v: number) => ({ sets: lastSets, ...valueFields(workout, v) });
  const held2 = { ...held, ...at(value) };

  // ── Long gaps ──
  if (daysSince !== null && daysSince > RETEST_DAYS) {
    return fromBenchmark(workout, { ...input, logs: [], benchmarks: [] }, finish, lastLine);
  }
  if (daysSince !== null && daysSince > DETRAIN_DAYS) {
    const down = stepValue(workout, value, -1) ?? value;
    return finish({
      kind: 'backoff',
      ...held,
      ...at(down),
      because: `${lastLine}. That was ${ago(daysSince)}, so today starts a step back: ${formatMetric(workout.metric, down)}.`,
    });
  }

  // ── Pain ──
  if (last.outcome === 'pain') {
    const down = stepValue(workout, value, -1) ?? value;
    return finish({
      kind: 'backoff',
      ...held,
      ...at(down),
      because: `${lastLine}. Pain last time, so a step back: ${formatMetric(workout.metric, down)}.`,
      advice: 'Stop at the first twinge. If it comes back, skip this one today and just climb.',
    });
  }

  // ── Failed sets ──
  if (last.outcome === 'failed') {
    const prev = summaries[1];
    const failedTwice = prev?.outcome === 'failed' && prev.value === value;
    const halfFailed = last.cleanSets * 2 <= last.totalSets;
    if (failedTwice || halfFailed) {
      const down = stepValue(workout, value, -1) ?? value;
      return finish({
        kind: 'backoff',
        ...held,
        ...at(down),
        because: `${lastLine}. ${failedTwice ? 'Two sessions failing here' : 'Half the sets failed'} — drop to ${formatMetric(workout.metric, down)} and own it.`,
      });
    }
    return finish({
      kind: 'hold',
      ...held2,
      because: `${lastLine}. Close — same ${formatMetric(workout.metric, value)} until every set is clean.`,
    });
  }

  const stalled = isStalled(workout, summaries);
  const swap = STALL_SWAP[workout.id];
  const stallAdvice = stalled
    ? `No gain in ${STALL_SESSIONS} sessions. ${
        swap
          ? `Switch to ${workoutById(swap)?.name ?? swap} for 2–3 weeks, then come back.`
          : 'Change the stimulus — a different grip, edge, or protocol for 2–3 weeks.'
      }`
    : undefined;

  // ── Clean ──
  const prev = summaries[1];
  const solidTwice = last.outcome === 'solid' && prev?.outcome === 'solid' && prev.value === value;
  if (last.outcome === 'easy' || solidTwice) {
    const up = stepValue(workout, value, 1);
    if (up === null) {
      return finish({
        kind: 'hold',
        ...held2,
        because: `${lastLine}. That's the top of this protocol.`,
        advice: workout.ceiling,
        stalled,
      });
    }
    return finish({
      kind: 'progress',
      ...held,
      ...at(up),
      because: `${lastLine}${solidTwice ? ', twice running' : ''}. Today: ${formatMetric(workout.metric, up)}.`,
      advice: stallAdvice,
      stalled,
    });
  }

  if (last.outcome === 'solid' || last.outcome === 'unrated') {
    return finish({
      kind: 'hold',
      ...held2,
      because:
        last.outcome === 'unrated'
          ? `${lastLine}. No RPE logged, so repeat ${formatMetric(workout.metric, value)} and rate each set — that's what earns the next step.`
          : `${lastLine}. Repeat ${formatMetric(workout.metric, value)}; clean again and it goes up.`,
      advice: stallAdvice,
      stalled,
    });
  }

  // maxed: clean but over the target RPE.
  return finish({
    kind: 'hold',
    ...held2,
    because: `${lastLine} — harder than the RPE ${workout.targetRpe} target. Hold ${formatMetric(workout.metric, value)} until it comes down.`,
    advice: stallAdvice,
    stalled,
  });
}

function valueFields(workout: Workout, v: number): Partial<WorkoutTarget> & { sets?: number } {
  switch (workout.metric) {
    case 'load':
      return { loadLb: v };
    case 'edge':
      return { edgeMm: v };
    case 'level':
      return { level: v };
    case 'reps':
      return { reps: v };
    case 'sets':
      return { sets: clampSets(workout, v) };
    default:
      return {};
  }
}

/** No notebook entries: start from an older benchmark, or make today the test. */
function fromBenchmark(
  workout: Workout,
  input: ProgressInput,
  finish: (t: TargetDraft) => WorkoutTarget,
  lastLine?: string,
): WorkoutTarget {
  const defaults = workout.defaults ?? {};
  const protocol = workout.trackableId ? protocolById(workout.trackableId) : null;
  const baseline =
    protocol && input.benchmarks
      ? resolveBaseline(protocol.id, input.benchmarks, input.nowMs)
      : null;
  const base = {
    edgeMm: defaults.edgeMm,
    grip: defaults.grip,
    level: defaults.level,
    sets: workout.sets[0],
  };

  if (baseline && baseline.value !== null && baseline.confidence !== 'none') {
    const v =
      baseline.confidence === 'stale'
        ? (stepValue(workout, baseline.value, -1) ?? baseline.value)
        : baseline.value;
    return finish({
      kind: baseline.confidence === 'stale' ? 'backoff' : 'hold',
      ...base,
      ...valueFields(workout, v),
      because: `Your last ${protocol!.name.toLowerCase()} was ${formatMetric(workout.metric, baseline.value)}${
        baseline.confidence === 'stale' ? ', a while ago, so start a step lighter' : ''
      }. Log every set today and the plan takes it from there.`,
    });
  }

  const start = workout.metric === 'load' ? (defaults.loadLb ?? 0) : undefined;
  const how =
    workout.metric === 'load'
      ? `Start at ${formatLoad(start ?? 0)} and add ${workout.step} lb each set until it's hard but clean (RPE ${workout.targetRpe}). That last clean set is your number.`
      : workout.metric === 'edge'
        ? `Find the smallest edge you can barely hold for 15 s — that's your edge.`
        : workout.metric === 'level'
          ? `Start at L1; if every set is clean and not hard, go up a level next time.`
          : `Start at the bottom of the range (${plural(workout.sets[0], 'set')}) and rate each set.`;
  return finish({
    kind: 'test',
    ...base,
    ...(start !== undefined ? { loadLb: start } : {}),
    because: `${lastLine ? `${lastLine} — too long ago to go by. ` : 'Nothing logged yet. '}Today finds your number. ${how}`,
  });
}

export interface SetAdjustment {
  loadLb?: number;
  edgeMm?: number;
  message: string;
}

/**
 * In-session autoregulation after the first working set (Ch 8: let early
 * feedback set the day). Failing set 1 drops a step; a set 1 at least 1.5 RPE
 * under target adds one. Anything else: carry on as planned.
 */
export function adjustAfterFirstSet(
  workout: Workout,
  target: Pick<WorkoutTarget, 'loadLb' | 'edgeMm'>,
  first: SetLog,
): SetAdjustment | null {
  const easy = first.completed && first.rpe !== undefined && first.rpe <= workout.targetRpe - 1.5;
  const failed = !first.completed;
  if (!easy && !failed) return null;

  if (workout.metric === 'load' && target.loadLb !== undefined) {
    const loadLb = target.loadLb + (failed ? -workout.step : workout.step);
    return {
      loadLb,
      message: failed
        ? `Set 1 didn't go. Drop to ${formatLoad(loadLb)} for the rest.`
        : `Set 1 was easy. Go to ${formatLoad(loadLb)} for the rest.`,
    };
  }
  if (workout.metric === 'edge' && target.edgeMm !== undefined) {
    const edgeMm = target.edgeMm + (failed ? workout.step : -workout.step);
    if (!failed && workout.min !== undefined && edgeMm < workout.min) return null;
    return {
      edgeMm,
      message: failed
        ? `Set 1 didn't go. Move up to the ${edgeMm} mm edge.`
        : `Set 1 was easy. Try the ${edgeMm} mm edge.`,
    };
  }
  return failed
    ? { message: "Set 1 didn't go. Finish the session at this level and log it." }
    : null;
}

/**
 * The one number today's target moves, as it should appear in the plan text
 * ("+30 lb", "12 mm", "L3"). Null on a test or a feel day, where there's no
 * number to hold the coach to.
 */
export function targetNumber(workout: Workout, t: WorkoutTarget): string | null {
  if (t.kind === 'test' || t.kind === 'feel') return null;
  const value =
    workout.metric === 'load'
      ? t.loadLb
      : workout.metric === 'edge'
        ? t.edgeMm
        : workout.metric === 'level'
          ? t.level
          : workout.metric === 'reps'
            ? t.reps
            : workout.metric === 'sets'
              ? t.sets
              : undefined;
  return value === undefined ? null : formatMetric(workout.metric, value);
}

/** The interval shape a session runs today: the target's sets, level, and reps. */
export function sessionSpec(workout: Workout, t: Pick<WorkoutTarget, 'sets' | 'level' | 'reps'>) {
  return workout.intervals?.({ sets: t.sets, level: t.level, reps: t.reps }) ?? null;
}

/**
 * The single number a finished session writes to the workout's benchmark
 * (content/protocols), so trend charts and older screens keep working.
 * Null when the workout has no benchmark or the session has no such number.
 */
export function trackableValue(workout: Workout, log: ExerciseLogRecord): number | null {
  const protocol = workout.trackableId ? protocolById(workout.trackableId) : null;
  if (!protocol) return null;
  if (protocol.unit === 'lb') {
    const loads = log.sets
      .filter((s) => s.completed)
      .map((s) => s.loadLb)
      .filter((n): n is number => typeof n === 'number');
    return loads.length > 0 ? Math.max(...loads) : null;
  }
  if (protocol.unit === 'level') return log.level ?? null;
  if (protocol.unit === 'seconds') {
    const secs = log.sets.map((s) => s.seconds).filter((n): n is number => typeof n === 'number');
    return secs.length > 0 ? Math.max(...secs) : null;
  }
  return null;
}
