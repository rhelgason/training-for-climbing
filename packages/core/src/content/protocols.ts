/**
 * Trackable protocols — the handful of prescribed exercises where progress is a
 * single number worth remembering session to session.
 *
 * Deliberately narrow. A general "log your sets and reps" form is the kind of
 * thing that gets built and never filled in; this exists only so that when the
 * plan already says "max-weight 10-second hangs", the app can show the weight
 * you used last time and let you confirm or nudge it in one tap. Anything that
 * would need a second screen doesn't belong here.
 *
 * Each protocol tracks **one progression variable** with everything else held
 * constant, because that's how these actually progress: min-edge hangs get
 * harder by shrinking the edge, max-weight hangs by adding weight, repeaters by
 * advancing a level. The held-constant part is shown as context, not recorded.
 *
 * Values are stored as ordinary `BenchmarkRecord`s keyed by `id`, so they flow
 * into the existing trend charts and the coach's fitness summary for free.
 *
 * Source (maintainers only): Eric J. Hörst, *Training for Climbing* (3rd ed.) —
 * fingerboard protocols Tables 8.2–8.4, repeaters 8.6–8.7, HIT 8.5.
 */

/** The unit of a protocol's progression variable. */
export type ProtocolUnit = 'lb' | 'mm' | 'level' | 'rung' | 'reps' | 'seconds';

/**
 * How far the daily plan goes in telling the climber what number to hit.
 *
 *  - `exact`   — the plan prescribes a specific target off their logged baseline,
 *                and prescribes a test session when there isn't one yet.
 *  - `general` — the plan gives dosage guidance but no number to chase.
 *  - `track`   — the plan names the exercise and records what they did; choosing
 *                the load is theirs.
 *
 * Only the fingerboard protocols are `exact`. That's a deliberate limit, not an
 * unfinished one: fingers are the tissue that takes months to heal and the one
 * where a confidently wrong number does real damage, so they're the place worth
 * the rigour of a measured baseline. Barbell work stays `track` — prescribing
 * someone's deadlift is a different sport with its own coaching, and this app
 * has no business doing it.
 */
export type ProtocolPrescriptionMode = 'exact' | 'general' | 'track';

export interface TrackableProtocol {
  /** Stable id, used directly as the benchmark `testId`. Never renumber these. */
  id: string;
  /** Exercise library ids this protocol attaches to. */
  exerciseIds: string[];
  /** Display name for trend charts and the coach's fitness summary. */
  name: string;
  /** What the number means, e.g. "Added weight". */
  metricLabel: string;
  unit: ProtocolUnit;
  /** What stays fixed while the number moves, shown as context. */
  heldConstant?: string;
  /** True when a smaller number is the improvement (edge size). */
  lowerIsBetter?: boolean;
  /** Starting point when there's no history to pre-fill from. */
  defaultValue: number;
  /** Increment for the +/− controls. */
  step: number;
  /** How far the daily plan goes in prescribing this number. */
  prescription: ProtocolPrescriptionMode;
}

export const TRACKABLE_PROTOCOLS: TrackableProtocol[] = [
  {
    id: 'protocol-max-weight-hang',
    exerciseIds: ['fingerboard-pyramids'],
    name: 'Max-weight hangs',
    metricLabel: 'Added weight',
    unit: 'lb',
    heldConstant: 'on a 14–20 mm edge, half-crimp or open-hand',
    defaultValue: 0,
    step: 5,
    prescription: 'exact',
  },
  {
    id: 'protocol-repeaters-level',
    exerciseIds: ['fingerboard-repeaters'],
    name: 'Repeaters level',
    metricLabel: 'Level',
    unit: 'level',
    heldConstant: 'L1 10/30 · L2 10/20 · L3 10/10 · L4 10/5',
    defaultValue: 1,
    step: 1,
    prescription: 'exact',
  },
  {
    id: 'protocol-moving-hang-seconds',
    exerciseIds: ['fingerboard-moving-hangs'],
    name: 'Moving hangs — time under tension',
    metricLabel: 'Longest set',
    unit: 'seconds',
    defaultValue: 30,
    step: 5,
    prescription: 'exact',
  },
  {
    id: 'protocol-hit-weight',
    exerciseIds: ['hit'],
    name: 'HIT added weight',
    metricLabel: 'Added weight',
    unit: 'lb',
    heldConstant: 'hardest grip first, each set under 15 s',
    defaultValue: 0,
    step: 5,
    prescription: 'track',
  },
  {
    id: 'protocol-hypergravity-boulder-weight',
    exerciseIds: ['hypergravity-bouldering'],
    name: 'Hypergravity bouldering — added weight',
    metricLabel: 'Added weight',
    unit: 'lb',
    defaultValue: 0,
    step: 5,
    prescription: 'track',
  },
  {
    id: 'protocol-campus-rung',
    exerciseIds: ['campus-laddering', 'campus-double-dynos', 'campus-lock-offs'],
    name: 'Campus — highest rung reached',
    metricLabel: 'Top rung',
    unit: 'rung',
    heldConstant: 'from rung 1, matched hands',
    defaultValue: 4,
    step: 1,
    prescription: 'track',
  },
  {
    id: 'protocol-weighted-pullup',
    exerciseIds: ['hypergravity-pull-ups'],
    name: 'Weighted pull-ups — added weight',
    metricLabel: 'Added weight',
    unit: 'lb',
    defaultValue: 0,
    step: 5,
    prescription: 'track',
  },
  {
    id: 'protocol-pullup-reps',
    exerciseIds: ['pull-ups'],
    name: 'Pull-ups — max reps',
    metricLabel: 'Max reps',
    unit: 'reps',
    defaultValue: 8,
    step: 1,
    prescription: 'track',
  },
  {
    id: 'protocol-lock-off-seconds',
    exerciseIds: ['one-arm-lock-offs'],
    name: 'One-arm lock-off — hold time',
    metricLabel: 'Hold',
    unit: 'seconds',
    heldConstant: 'weakest side',
    defaultValue: 5,
    step: 1,
    prescription: 'track',
  },
  {
    id: 'protocol-arc-minutes',
    exerciseIds: ['arc-traverses'],
    name: 'ARC — continuous time',
    metricLabel: 'Continuous',
    unit: 'seconds',
    heldConstant: 'RPE 4–6, no pump',
    defaultValue: 900,
    step: 300,
    prescription: 'general',
  },
  {
    id: 'protocol-deadlift',
    exerciseIds: ['deadlift', 'sumo-deadlift'],
    name: 'Deadlift — working weight',
    metricLabel: 'Working weight',
    unit: 'lb',
    heldConstant: 'top set of 3',
    defaultValue: 135,
    step: 10,
    prescription: 'track',
  },
  {
    id: 'protocol-squat',
    exerciseIds: ['barbell-squat'],
    name: 'Squat — working weight',
    metricLabel: 'Working weight',
    unit: 'lb',
    heldConstant: 'top set of 5',
    defaultValue: 95,
    step: 10,
    prescription: 'track',
  },
];

const BY_EXERCISE = new Map<string, TrackableProtocol>();
for (const protocol of TRACKABLE_PROTOCOLS) {
  for (const exerciseId of protocol.exerciseIds) BY_EXERCISE.set(exerciseId, protocol);
}

const BY_ID = new Map(TRACKABLE_PROTOCOLS.map((p) => [p.id, p]));

/** The protocol attached to a library exercise, if it has one. */
export function protocolForExercise(exerciseId: string): TrackableProtocol | null {
  return BY_EXERCISE.get(exerciseId) ?? null;
}

export function protocolById(id: string): TrackableProtocol | null {
  return BY_ID.get(id) ?? null;
}

/** Render a stored value the way the climber entered it. */
export function formatProtocolValue(protocol: TrackableProtocol, value: number): string {
  switch (protocol.unit) {
    case 'lb':
      return `${value > 0 ? '+' : ''}${value} lb`;
    case 'mm':
      return `${value} mm`;
    case 'level':
      return `L${value}`;
    case 'rung':
      return `rung ${value}`;
    case 'reps':
      return `${value} reps`;
    case 'seconds':
      // Long efforts read better in minutes; short ones don't.
      return value >= 120 ? `${Math.round(value / 60)} min` : `${value} s`;
  }
}
