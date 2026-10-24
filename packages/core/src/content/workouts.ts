/**
 * Workouts — the exercises the daily plan prescribes, as protocols a timer can
 * run and a logger can record set by set.
 *
 * Each one carries the book's numbers (sets, reps, work and rest seconds), the
 * single number that progresses session to session, and the RPE the working
 * sets should land at. `features/train/progression` reads the logged sets
 * against these to decide today's target; `features/train/timer` turns the
 * interval shape into phases.
 *
 * Source (maintainers only — the coach is told not to cite sources):
 * Eric J. Hörst, *Training for Climbing* (3rd ed., 2016) — min-edge, max-weight
 * 10 s and 7-53 hangs (Tables 8.2–8.4), HIT (8.5, 8.9), repeaters (8.6, 8.7),
 * bouldering and hypergravity bouldering, campus laddering / bumps / switch
 * hands (Ch 8), 4x4s (8.8), ARC, moving hangs and threshold intervals (Ch 8),
 * weighted pull-ups, pull-up intervals (9.2), Frenchies, lock-offs, 1-3-5-7
 * power ladders (Ch 9). RPE scale: figure 8.3.
 */
import type { GripId } from '../db/types';
import type { AbilityTier } from './planning';
import type { EquipmentId, SessionFocusId } from './trainingContext';

/** The number that moves from one session to the next. */
export type WorkoutMetric =
  /** Added weight, lb. */
  | 'load'
  /** Edge depth, mm. Smaller is harder. */
  | 'edge'
  /** A protocol level (repeaters L1–L4). */
  | 'level'
  /** Reps per set or interval (pull-ups per minute, Frenchie cycles). */
  | 'reps'
  /** Number of quality sets (campus, hypergravity bouldering). */
  | 'sets'
  /** Climbing grade of the problems or routes. */
  | 'grade'
  /** Judged by feel; logged, never progressed by a number. */
  | 'feel';

/** What a set row asks for when it is logged. */
export type SetField = 'load' | 'reps' | 'seconds' | 'grade' | 'grip' | 'side';

/** One timed block: `repsPerSet` efforts of `workSec`, `restSec` apart, `setRestSec` between sets. */
export interface IntervalSpec {
  sets: number;
  repsPerSet: number;
  workSec: number;
  restSec: number;
  setRestSec: number;
}

export interface Workout {
  id: string;
  name: string;
  /** Library exercise this runs (content/exercises). */
  exerciseId?: string;
  focus: SessionFocusId;
  /** Needs one of these. Empty means bodyweight only. */
  equipment: EquipmentId[];
  /** How to do it, in the book's numbers. */
  how: string;
  /** Form cues shown on the session screen. */
  cues: string[];
  metric: WorkoutMetric;
  /** Increment for the metric, in its own unit. */
  step: number;
  /** Bounds on the metric. */
  min?: number;
  max?: number;
  /** Book set range; progression never goes outside it. */
  sets: [number, number];
  /** Efforts per set: hangs, pull-ups, ascents, laps. */
  reps: number;
  /** Where a working set should land on the 1–10 RPE scale. */
  targetRpe: number;
  /** Timer shape. Repeaters take their rest from the level. */
  intervals?: (opts: { sets: number; level?: number; reps?: number }) => IntervalSpec;
  /** Fields each set row records. */
  logs: SetField[];
  /** Grip for each set in order, cycling. HIT and repeaters rotate grips. */
  gripPlan?: GripId[];
  defaults?: { edgeMm?: number; grip?: GripId; level?: number; loadLb?: number };
  /** Benchmark id the session's top value also writes, for trends and older history. */
  trackableId?: string;
  /** Only for climbers at or above this tier. */
  minTier: AbilityTier;
  /** What the book says to do when the metric tops out. */
  ceiling?: string;
}

export const GRIP_LABELS: Record<GripId, string> = {
  'half-crimp': 'Half crimp',
  'open-crimp': 'Open crimp',
  'open-hand': 'Open hand',
  pinch: 'Wide pinch',
  'pocket-front': '2-finger front (index + middle)',
  'pocket-middle': '2-finger middle (middle + ring)',
  'pocket-back': '2-finger back (ring + pinky)',
};

export const GRIP_IDS = Object.keys(GRIP_LABELS) as GripId[];

/** Hörst's HIT order — hardest grip first for most people. */
const HIT_GRIP_ORDER: GripId[] = [
  'pinch',
  'pocket-back',
  'pocket-front',
  'pocket-middle',
  'half-crimp',
  'open-hand',
];

/** Short repeaters (Table 8.6): 10 s on, rest by level. */
export const SHORT_REPEATER_REST: Record<number, number> = { 1: 30, 2: 20, 3: 10, 4: 5 };
/** Long repeaters (Table 8.7): work and rest by level. */
export const LONG_REPEATER: Record<number, { work: number; rest: number }> = {
  1: { work: 30, rest: 30 },
  2: { work: 30, rest: 15 },
  3: { work: 60, rest: 30 },
  4: { work: 60, rest: 15 },
};

const FINGERBOARD: EquipmentId[] = ['hangboard'];
const WALL: EquipmentId[] = ['boulder-wall', 'steep-wall', 'system-board'];
const CAMPUS: EquipmentId[] = ['campus-board'];
const BAR: EquipmentId[] = ['pull-up-bar', 'hangboard'];

const HANG_CUES = [
  'Shoulders engaged, chest out — never a shrugged dead hang.',
  'Half crimp with no thumb lock, or open hand.',
  'Stop at the first twinge in a finger, elbow, or shoulder.',
];

export const WORKOUTS: Workout[] = [
  // ── Max strength: fingers ────────────────────────────────────────────────
  {
    id: 'max-hang-10',
    name: 'Max-weight hangs (10 s)',
    exerciseId: 'fingerboard-pyramids',
    focus: 'maxStrength',
    equipment: FINGERBOARD,
    how: '5 hangs × 10 s, 3 min rest between hangs, 5 min between sets, on a 14–20 mm edge. Load so you would fail around 13 s; end every hang at 10 s.',
    cues: HANG_CUES,
    metric: 'load',
    step: 5,
    sets: [2, 5],
    reps: 5,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 5, workSec: 10, restSec: 180, setRestSec: 300 }),
    logs: ['load', 'reps'],
    defaults: { edgeMm: 20, grip: 'half-crimp', loadLb: 0 },
    trackableId: 'protocol-max-weight-hang',
    minTier: 'intermediate',
  },
  {
    id: 'max-hang-7-53',
    name: 'Max-weight 7-53 hangs',
    exerciseId: 'fingerboard-pyramids',
    focus: 'maxStrength',
    equipment: FINGERBOARD,
    how: '3 hangs × 7 s with 53 s rest, 5 min between sets, on a 14–20 mm edge. Load so you would fail around 10 s; end every hang at 7 s. Do this or the 10 s hangs, not both.',
    cues: HANG_CUES,
    metric: 'load',
    step: 5,
    sets: [2, 5],
    reps: 3,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 3, workSec: 7, restSec: 53, setRestSec: 300 }),
    logs: ['load', 'reps'],
    defaults: { edgeMm: 20, grip: 'half-crimp', loadLb: 0 },
    minTier: 'intermediate',
  },
  {
    id: 'min-edge-hangs',
    name: 'Minimum-edge hangs',
    exerciseId: 'fingerboard-pyramids',
    focus: 'maxStrength',
    equipment: FINGERBOARD,
    how: '5 hangs × 12 s, 3 min rest between hangs, 5 min between sets, on the smallest edge you can barely hold for 15 s. RPE 9–9.5, little to no pump.',
    cues: HANG_CUES,
    metric: 'edge',
    step: 2,
    min: 10,
    max: 30,
    sets: [2, 5],
    reps: 5,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 5, workSec: 12, restSec: 180, setRestSec: 300 }),
    logs: ['reps'],
    defaults: { edgeMm: 18, grip: 'half-crimp' },
    minTier: 'intermediate',
    ceiling:
      'Edges under about 10 mm get painful. Move to max-weight hangs on a 14–20 mm edge and add load instead.',
  },
  {
    id: 'hit-max',
    name: 'HIT — max strength',
    exerciseId: 'hit',
    focus: 'maxStrength',
    equipment: ['system-board', 'steep-wall'],
    how: 'One grip per set, up and down the strips on a 45–55° wall, feet on. Each set under 15 s (8–15 hand moves), 3 min rest. Hardest grip first. Add weight until 10 moves is an effort of 9.',
    cues: [
      'Climb briskly — no chalking or pausing mid-set.',
      'Step off rather than fall with weight on.',
      'Belt near your hips; a vest above about 30 lb.',
    ],
    metric: 'load',
    step: 5,
    sets: [6, 12],
    reps: 10,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 15, restSec: 0, setRestSec: 180 }),
    logs: ['load', 'reps', 'grip'],
    gripPlan: HIT_GRIP_ORDER,
    defaults: { loadLb: 0 },
    trackableId: 'protocol-hit-weight',
    minTier: 'intermediate',
  },
  {
    id: 'limit-bouldering',
    name: 'Limit bouldering',
    exerciseId: 'bouldering',
    focus: 'maxStrength',
    equipment: WALL,
    how: 'Short, steep problems climbable in under 15 s, each isolating one grip. 3 attempts per problem is a set, 2–3 min between attempts. 3–10 sets over 30–60 minutes.',
    cues: [
      'If you get properly pumped, the problem is too long.',
      'Theme each problem: crimps, pinches, pockets, open hand.',
      'Step off rather than thrash into the pump.',
    ],
    metric: 'grade',
    step: 1,
    sets: [3, 10],
    reps: 3,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 3, workSec: 15, restSec: 150, setRestSec: 150 }),
    logs: ['grade', 'reps', 'grip'],
    minTier: 'beginner',
  },
  {
    id: 'hypergravity-bouldering',
    name: 'Hypergravity bouldering',
    exerciseId: 'hypergravity-bouldering',
    focus: 'maxStrength',
    equipment: WALL,
    how: 'Weight belt on, short overhanging problems a couple of grades below your limit, under 15 s each, no dynos. 3 ascents is a set, 2–3 min between ascents. Start with 2 sets; build to 5–7.',
    cues: [
      'Indoors only.',
      'Small-to-medium holds, nothing tiny or tweaky.',
      'Downclimb or step off — never fall with the belt on.',
    ],
    metric: 'sets',
    step: 1,
    min: 2,
    max: 7,
    sets: [2, 7],
    reps: 3,
    targetRpe: 8.5,
    intervals: ({ sets }) => ({ sets, repsPerSet: 3, workSec: 15, restSec: 150, setRestSec: 150 }),
    logs: ['load', 'reps', 'grade'],
    defaults: { loadLb: 10 },
    trackableId: 'protocol-hypergravity-boulder-weight',
    minTier: 'elite',
    ceiling: 'At 7 sets, add 5 lb to the belt and drop back to 5 sets.',
  },

  // ── Power / contact strength ─────────────────────────────────────────────
  {
    id: 'campus-ladder',
    name: 'Campus laddering',
    exerciseId: 'campus-laddering',
    focus: 'power',
    equipment: CAMPUS,
    how: 'Hand over hand up the board, no feet, as fast as possible — 8 moves in 3–6 s on the smallest rungs you can ladder without skipping. 2–3 min rest. Start at 3 sets; build to 10.',
    cues: [
      'Open hand or open crimp only.',
      'Slight elbow bend on every catch; never a straight-arm shrug.',
      'Stop at the first ugly catch or any pain.',
    ],
    metric: 'sets',
    step: 1,
    min: 3,
    max: 10,
    sets: [3, 10],
    reps: 1,
    targetRpe: 8,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 6, restSec: 0, setRestSec: 150 }),
    logs: ['reps', 'seconds'],
    minTier: 'intermediate',
    ceiling: 'At 10 sets, use smaller rungs or add 5–10 lb rather than skipping rungs.',
  },
  {
    id: 'campus-power-ladder',
    name: 'Campus 1-3-5-7 power ladder',
    exerciseId: 'campus-laddering',
    focus: 'power',
    equipment: CAMPUS,
    how: 'Largest rungs, both hands on 1, ladder 1-3-5-7 as a sprint. At least 3 min rest. Start at 3 sets; build to 10. 1-4-7 only once 1-3-5-7 never fails.',
    cues: [
      'If you pause or break sequence, you are too tired — stop.',
      'Never latch a rung with a fully straight arm.',
    ],
    metric: 'sets',
    step: 1,
    min: 3,
    max: 10,
    sets: [3, 10],
    reps: 1,
    targetRpe: 8,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 5, restSec: 0, setRestSec: 180 }),
    logs: ['reps', 'seconds'],
    minTier: 'intermediate',
    ceiling: 'At 10 clean sets, try 1-4-7.',
  },
  {
    id: 'campus-bumps',
    name: 'Campus bumps',
    exerciseId: 'campus-laddering',
    focus: 'power',
    equipment: CAMPUS,
    how: 'One hand stays on the bottom rung while the other bumps up 3–4 rungs as fast as possible. 2 min rest. Start at 2–3 sets each side; build to 10.',
    cues: [
      'Highest bump with a bent arm, never a shrug.',
      'Feet on below the board to make it easier.',
    ],
    metric: 'sets',
    step: 1,
    min: 2,
    max: 10,
    sets: [2, 10],
    reps: 2,
    targetRpe: 8,
    intervals: ({ sets }) => ({ sets, repsPerSet: 2, workSec: 5, restSec: 60, setRestSec: 120 }),
    logs: ['reps', 'side'],
    minTier: 'intermediate',
    ceiling: 'At 10 sets a side, use smaller rungs or add a little weight.',
  },
  {
    id: 'campus-switch-hands',
    name: 'Campus switch hands',
    exerciseId: 'campus-double-dynos',
    focus: 'power',
    equipment: CAMPUS,
    how: 'Hands on adjacent rungs, short sharp pull, switch both hands at the deadpoint — 10–12 switches in about 5 s. Start with 2 sets, 2 min apart; build to 6 sets with 30–60 s rest.',
    cues: ['Positive medium-to-large rungs, open hand.', 'Very little up-and-down torso movement.'],
    metric: 'sets',
    step: 1,
    min: 2,
    max: 6,
    sets: [2, 6],
    reps: 1,
    targetRpe: 8,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 6, restSec: 0, setRestSec: 120 }),
    logs: ['reps'],
    minTier: 'elite',
    ceiling: 'At 6 sets, cut the rest toward 30–60 s to train aerobic power.',
  },

  // ── Pull muscles: strength and power endurance ───────────────────────────
  {
    id: 'weighted-pullups',
    name: 'Weighted pull-ups',
    exerciseId: 'hypergravity-pull-ups',
    focus: 'maxStrength',
    equipment: BAR,
    how: '3–6 sets of 5, with a load you could do about 7 times. Explode up, lower under control, stop just short of straight arms. At least 3 min rest.',
    cues: ['No straight-arm hang with weight on.', 'Same grip and range every rep.'],
    metric: 'load',
    step: 5,
    sets: [3, 6],
    reps: 5,
    targetRpe: 8,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 20, restSec: 0, setRestSec: 180 }),
    logs: ['load', 'reps'],
    defaults: { loadLb: 0 },
    trackableId: 'protocol-weighted-pullup',
    minTier: 'intermediate',
  },
  {
    id: 'pullup-intervals',
    name: 'Pull-up intervals',
    exerciseId: 'pull-up-intervals',
    focus: 'powerEndurance',
    equipment: BAR,
    how: '20 one-minute intervals: a set number of pull-ups at the top of each minute, rest the remainder. Progress by one pull-up per interval, never by weight.',
    cues: [
      'Same rep count every minute — finish all 20.',
      'Cut a rep rather than miss the full 20 minutes.',
    ],
    metric: 'reps',
    step: 1,
    min: 1,
    sets: [20, 20],
    reps: 4,
    targetRpe: 8.5,
    intervals: ({ reps }) => ({
      sets: 1,
      repsPerSet: 20,
      workSec: Math.max(5, (reps ?? 4) * 2),
      restSec: 60 - Math.max(5, (reps ?? 4) * 2),
      setRestSec: 0,
    }),
    logs: ['reps'],
    minTier: 'beginner',
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    exerciseId: 'frenchies',
    focus: 'powerEndurance',
    equipment: BAR,
    how: 'Pull up and lock off 4 s at the top, then at 90°, then at 120° — one cycle. Cycles to near failure (30–90 s), 2–4 sets, 5 min rest. Add a 10–20 lb belt once 5–6 cycles are clean.',
    cues: ['Full 4 s at each angle.', 'Engaged shoulders through the bottom.'],
    metric: 'reps',
    step: 1,
    min: 2,
    max: 6,
    sets: [2, 4],
    reps: 3,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 60, restSec: 0, setRestSec: 300 }),
    logs: ['reps', 'load'],
    minTier: 'intermediate',
    ceiling: 'At 6 clean cycles, add 10 lb and drop back to 3 cycles.',
  },
  {
    id: 'one-arm-lockoffs',
    name: 'One-arm lock-offs',
    exerciseId: 'one-arm-lock-offs',
    focus: 'maxStrength',
    equipment: BAR,
    how: 'Pull up with both arms, let go with one and hold the lock-off as long as you can, then lower slowly and grab back on before 120°. 2 reps each side per set, 2–3 min rest.',
    cues: [
      'Bar tight to the cheek of the working side.',
      'Shoulder packed, no twisting off the bar.',
    ],
    metric: 'feel',
    step: 1,
    sets: [1, 3],
    reps: 4,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 4, workSec: 10, restSec: 30, setRestSec: 150 }),
    logs: ['seconds', 'side'],
    trackableId: 'protocol-lock-off-seconds',
    minTier: 'elite',
  },

  // ── Strength / power endurance ───────────────────────────────────────────
  {
    id: 'repeaters-short',
    name: 'Repeaters (10 s on)',
    exerciseId: 'fingerboard-repeaters',
    focus: 'powerEndurance',
    equipment: FINGERBOARD,
    how: '6 hangs × 10 s per set, rest by level (L1 30 s, L2 20 s, L3 10 s, L4 5 s), 1 min between sets, up to 5 sets. Alternate half crimp and open hand by set.',
    cues: [...HANG_CUES, 'End a hang early if the shoulders start to creep up.'],
    metric: 'level',
    step: 1,
    min: 1,
    max: 4,
    sets: [3, 5],
    reps: 6,
    targetRpe: 8.5,
    intervals: ({ sets, level }) => ({
      sets,
      repsPerSet: 6,
      workSec: 10,
      restSec: SHORT_REPEATER_REST[level ?? 1] ?? 30,
      setRestSec: 60,
    }),
    logs: ['reps', 'grip'],
    gripPlan: ['half-crimp', 'open-hand'],
    defaults: { level: 1, edgeMm: 20 },
    trackableId: 'protocol-repeaters-level',
    minTier: 'intermediate',
    ceiling: 'When 5 sets at L4 are not difficult, add a 10 lb belt or use smaller holds.',
  },
  {
    id: 'repeaters-long',
    name: 'Long repeaters',
    exerciseId: 'fingerboard-repeaters',
    focus: 'powerEndurance',
    equipment: FINGERBOARD,
    how: '4 hangs per set, work and rest by level (L1 30/30, L2 30/15, L3 60/30, L4 60/15), 1 min between sets, 3–5 sets. Move up a level once you complete 5 sets.',
    cues: [...HANG_CUES, 'This gets painful — that is the point. Form stays perfect.'],
    metric: 'level',
    step: 1,
    min: 1,
    max: 4,
    sets: [3, 5],
    reps: 4,
    targetRpe: 9,
    intervals: ({ sets, level }) => {
      const spec = LONG_REPEATER[level ?? 1] ?? LONG_REPEATER[1];
      return { sets, repsPerSet: 4, workSec: spec.work, restSec: spec.rest, setRestSec: 60 };
    },
    logs: ['reps', 'grip'],
    gripPlan: ['half-crimp', 'open-hand'],
    defaults: { level: 1, edgeMm: 20 },
    minTier: 'intermediate',
    ceiling: 'Past L4, add weight or use a smaller edge.',
  },
  {
    id: 'bouldering-4x4',
    name: 'Bouldering 4×4',
    exerciseId: 'interval-climbing',
    focus: 'powerEndurance',
    equipment: WALL,
    how: '4 problems, 4 laps each. One minute per lap including rest, 4 min rest after every 4th lap — about 30 minutes. Problems a few grades below your max (a V9 climber uses V4–V6), small holds, no big stopper moves.',
    cues: [
      'Each lap about 30 s.',
      'Fail only on the 4th pass, if at all.',
      'Run the timer — rests are the workout.',
    ],
    metric: 'grade',
    step: 1,
    sets: [4, 4],
    reps: 4,
    targetRpe: 9,
    intervals: () => ({ sets: 4, repsPerSet: 4, workSec: 30, restSec: 30, setRestSec: 240 }),
    logs: ['grade', 'reps'],
    minTier: 'intermediate',
  },
  {
    id: 'hit-endurance',
    name: 'HIT — strength endurance',
    exerciseId: 'hit',
    focus: 'powerEndurance',
    equipment: ['system-board', 'steep-wall'],
    how: 'Same as HIT max strength, lighter, sets of 30–90 s (20 s–2 min at the extremes), 1–3 sets per grip, 3 min rest. Up to 72 h to recover — plan around it.',
    cues: ['Tape (figure-8) so skin does not end the set early.'],
    metric: 'load',
    step: 5,
    sets: [4, 12],
    reps: 1,
    targetRpe: 9,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 60, restSec: 0, setRestSec: 180 }),
    logs: ['load', 'seconds', 'grip'],
    gripPlan: HIT_GRIP_ORDER,
    defaults: { loadLb: 0 },
    minTier: 'elite',
  },

  // ── Local aerobic endurance ──────────────────────────────────────────────
  {
    id: 'arc',
    name: 'ARC / recovery climbing',
    exerciseId: 'arc-traverses',
    focus: 'enduranceAerobic',
    equipment: ['boulder-wall', 'rope-wall', 'outdoor-rock'],
    how: 'Easy traversing or laps at RPE 4–6 — conversation pace, no real pump. Five-minute traverses with 2–5 min rest, about 30 minutes total.',
    cues: ['Step off at the first developing pump.', 'Even one hard problem sinks the ARC.'],
    metric: 'feel',
    step: 1,
    sets: [4, 6],
    reps: 1,
    targetRpe: 5,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 300, restSec: 0, setRestSec: 180 }),
    logs: ['seconds'],
    minTier: 'beginner',
  },
  {
    id: 'threshold-intervals',
    name: 'Threshold intervals',
    exerciseId: 'aerobic-intervals',
    focus: 'enduranceAerobic',
    equipment: ['boulder-wall', 'rope-wall', 'steep-wall'],
    how: '3–5 minute climbing intervals at RPE 7–8.5, equal rest. 4–8 intervals. End an interval early rather than push deep into the pump.',
    cues: ['Big holds and shake-outs on steep walls.', 'Breathing and pump stay controlled.'],
    metric: 'reps',
    step: 1,
    min: 4,
    max: 8,
    sets: [1, 1],
    reps: 4,
    targetRpe: 8,
    // One set per interval, so each one is logged and counted on its own.
    intervals: ({ reps }) => ({
      sets: reps ?? 4,
      repsPerSet: 1,
      workSec: 240,
      restSec: 0,
      setRestSec: 240,
    }),
    logs: ['seconds'],
    minTier: 'beginner',
  },
  {
    id: 'moving-hangs',
    name: 'Moving hangs',
    exerciseId: 'fingerboard-moving-hangs',
    focus: 'enduranceAerobic',
    equipment: FINGERBOARD,
    how: 'Feet on a chair, move hands around the board like climbing for 3–6 minutes at RPE 5–8.5, shaking out on jugs. 3–6 sets, climb:rest 2:1 to 1:1. A moderate pump, never a deep one.',
    cues: ['Unload with the feet as needed.', 'Core or antagonist work in the rests.'],
    metric: 'feel',
    step: 1,
    sets: [3, 6],
    reps: 1,
    targetRpe: 7,
    intervals: ({ sets }) => ({ sets, repsPerSet: 1, workSec: 240, restSec: 0, setRestSec: 180 }),
    logs: ['seconds'],
    trackableId: 'protocol-moving-hang-seconds',
    minTier: 'beginner',
  },
];

const BY_ID = new Map(WORKOUTS.map((w) => [w.id, w]));

export function workoutById(id: string): Workout | null {
  return BY_ID.get(id) ?? null;
}

/** Grip for set `index` (0-based), following the workout's rotation if it has one. */
export function gripForSet(workout: Workout, index: number, fallback?: GripId): GripId | undefined {
  const plan = workout.gripPlan;
  if (!plan || plan.length === 0) return fallback ?? workout.defaults?.grip;
  return plan[index % plan.length];
}

const TIER_ORDER: AbilityTier[] = ['beginner', 'intermediate', 'elite'];

/** True when one of the workout's equipment needs is on hand (or it needs none). */
export function workoutIsPossible(workout: Workout, available: EquipmentId[]): boolean {
  return workout.equipment.length === 0 || workout.equipment.some((e) => available.includes(e));
}

/** True when the climber's tier is high enough for the workout. */
export function workoutSuitsTier(workout: Workout, tier: AbilityTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(workout.minTier);
}
