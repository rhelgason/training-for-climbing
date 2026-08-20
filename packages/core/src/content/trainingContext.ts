/**
 * Training-context vocabulary: the equipment a climber can reach, how they feel
 * today, how long they have — and the **session-focus catalog**, which is where
 * the app's understanding of training *frequency* lives.
 *
 * Why a focus catalog rather than free-form advice: the hard-won rules of a
 * training week are all expressed per load type ("max strength twice a week,
 * 48 hours apart"; "power endurance is the easiest system to overtrain").
 * Encoding them as data makes them enforceable by the deterministic scheduler
 * (`features/plan/microcycle`) and testable, instead of hoping an LLM remembers
 * what you did on Tuesday.
 *
 * Source (maintainers only — the coach is told not to cite sources):
 * Eric J. Hörst, *Training for Climbing* (3rd ed., 2016) — within-session
 * hierarchy and rest (Ch 8, Ch 10 microcycle), energy-system frequencies and
 * the anaerobic-endurance overtraining caution (Ch 5, Tables 5.4–5.5).
 */
import type { HierarchyAreaId } from './planning';
import type { TriadArea } from './types';

// ── Equipment ──────────────────────────────────────────────────────────────

/** A piece of equipment (or wall type) a session can require. */
export type EquipmentId =
  | 'boulder-wall'
  | 'rope-wall'
  | 'steep-wall'
  | 'hangboard'
  | 'campus-board'
  | 'system-board'
  | 'free-weights'
  | 'pull-up-bar'
  | 'rings-trx'
  | 'bands'
  | 'cardio-machine'
  | 'outdoor-rock';

export const EQUIPMENT_IDS: EquipmentId[] = [
  'boulder-wall',
  'rope-wall',
  'steep-wall',
  'hangboard',
  'campus-board',
  'system-board',
  'free-weights',
  'pull-up-bar',
  'rings-trx',
  'bands',
  'cardio-machine',
  'outdoor-rock',
];

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  'boulder-wall': 'Bouldering wall',
  'rope-wall': 'Rope wall (lead / top-rope)',
  'steep-wall': 'Steep wall (30°+)',
  hangboard: 'Hangboard',
  'campus-board': 'Campus board',
  'system-board': 'System / spray board',
  'free-weights': 'Free weights',
  'pull-up-bar': 'Pull-up bar',
  'rings-trx': 'Rings or TRX',
  bands: 'Resistance bands',
  'cardio-machine': 'Cardio machine',
  'outdoor-rock': 'Outdoor rock',
};

/** Anything that counts as a climbable surface. */
export const CLIMBABLE_EQUIPMENT: EquipmentId[] = [
  'boulder-wall',
  'rope-wall',
  'steep-wall',
  'system-board',
  'outdoor-rock',
];

/** Named starting points so onboarding is a tap, not a checklist crawl. */
export interface EquipmentPreset {
  id: string;
  label: string;
  description: string;
  equipment: EquipmentId[];
}

export const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  {
    id: 'full-gym',
    label: 'Full climbing gym',
    description: 'Ropes, boulders, a board, and a weight room.',
    equipment: [
      'boulder-wall',
      'rope-wall',
      'steep-wall',
      'hangboard',
      'campus-board',
      'system-board',
      'free-weights',
      'pull-up-bar',
      'rings-trx',
      'bands',
      'cardio-machine',
    ],
  },
  {
    id: 'boulder-gym',
    label: 'Bouldering gym',
    description: 'Boulders and a board, no ropes.',
    equipment: [
      'boulder-wall',
      'steep-wall',
      'hangboard',
      'system-board',
      'free-weights',
      'pull-up-bar',
      'bands',
    ],
  },
  {
    id: 'home-wall',
    label: 'Home setup',
    description: 'A hangboard and whatever is in the garage.',
    equipment: ['hangboard', 'pull-up-bar', 'bands', 'free-weights'],
  },
  {
    id: 'outdoors',
    label: 'Mostly outdoors',
    description: 'Real rock, plus a hangboard at home.',
    equipment: ['outdoor-rock', 'hangboard', 'pull-up-bar', 'bands'],
  },
];

/** A sensible default until onboarding says otherwise: a typical rope-and-boulder gym. */
export const DEFAULT_EQUIPMENT: EquipmentId[] = [
  'boulder-wall',
  'rope-wall',
  'hangboard',
  'pull-up-bar',
];

// ── How today feels ────────────────────────────────────────────────────────

/** Self-reported readiness, gathered in the one-tap daily check-in. */
export type Readiness = 'fresh' | 'ok' | 'tired' | 'tweaky';

export const READINESS_OPTIONS: Readiness[] = ['fresh', 'ok', 'tired', 'tweaky'];

export const READINESS_LABELS: Record<Readiness, string> = {
  fresh: 'Fresh',
  ok: 'OK',
  tired: 'Tired',
  tweaky: 'Something hurts',
};

/** Roughly how long today's session can be. */
export type SessionLength = 'quick' | 'standard' | 'long';

export const SESSION_LENGTHS: SessionLength[] = ['quick', 'standard', 'long'];

export const SESSION_LENGTH_LABELS: Record<SessionLength, string> = {
  quick: 'Under 45 min',
  standard: '1–1.5 hours',
  long: '2+ hours',
};

/** Approximate minutes, used to decide how many blocks fit in the plan. */
export const SESSION_LENGTH_MINUTES: Record<SessionLength, number> = {
  quick: 40,
  standard: 90,
  long: 150,
};

// ── Style focus ────────────────────────────────────────────────────────────

/** What the climber is optimising for; biases which focus wins a free day. */
export type StyleFocus = 'boulder-power' | 'sport-endurance' | 'all-round' | 'trad-alpine';

export const STYLE_FOCUSES: StyleFocus[] = [
  'boulder-power',
  'sport-endurance',
  'all-round',
  'trad-alpine',
];

export const STYLE_FOCUS_LABELS: Record<StyleFocus, string> = {
  'boulder-power': 'Bouldering & power',
  'sport-endurance': 'Sport climbing & endurance',
  'all-round': 'All-round',
  'trad-alpine': 'Trad, multi-pitch & alpine',
};

// ── Session focuses: the unit of training load ─────────────────────────────

/**
 * The kind of stress a session applies. Frequency and recovery rules attach
 * here, so "how often may I do this?" has one answer in one place.
 */
export type SessionFocusId =
  | 'skill'
  | 'maxStrength'
  | 'power'
  | 'powerEndurance'
  | 'enduranceAerobic'
  | 'conditioning'
  | 'mental'
  | 'rest';

export interface SessionFocus {
  id: SessionFocusId;
  label: string;
  /** One line the UI and the coach can both use. */
  description: string;
  /** Systemic cost — drives consecutive-hard-day and readiness rules. */
  intensity: 'high' | 'moderate' | 'low';
  /**
   * Ceiling on sessions in any rolling 7 days. `null` means uncapped (it can be
   * trained daily). These are the numbers the scheduler enforces.
   */
  maxPerWeek: number | null;
  /**
   * Whole days that must separate two sessions of this focus. 2 means "48 hours"
   * — Monday then Wednesday at the earliest.
   */
  minDaysBetween: number;
  /**
   * A healthy weekly dose when this focus is a priority. The scheduler treats a
   * shortfall against this as "due".
   */
  targetPerWeek: number;
  /** Where it sits in the within-session order (so plans stay hierarchy-correct). */
  hierarchyAreaId: HierarchyAreaId;
  /** The triad area it develops, for weakest-area targeting. */
  triadArea: TriadArea;
  /**
   * Needs at least one of these to be possible today. Empty means it needs
   * nothing but your body.
   */
  requiresAnyOf: EquipmentId[];
  /** Only prescribe to climbers at or above this tier (index into ABILITY_TIERS). */
  minTierIndex: number;
}

/**
 * Frequency notes, so the numbers above are auditable:
 *  - maxStrength / power draw on the ATP-CP system and the nervous system: two
 *    quality sessions a week, never on back-to-back days.
 *  - powerEndurance is the least trainable and most overtrainable system — three
 *    a week is a hard ceiling and belongs in a short block, not year-round.
 *  - enduranceAerobic and skill are the cheap ones: train them most days.
 *  - conditioning is light enough to repeat daily but is capped so it never
 *    crowds out the work that actually moves the needle.
 */
export const SESSION_FOCUSES: SessionFocus[] = [
  {
    id: 'skill',
    label: 'Skill & movement',
    description:
      'Deliberate technique practice on terrain inside your limit, done fresh — the cheapest gains in climbing.',
    intensity: 'moderate',
    maxPerWeek: null,
    minDaysBetween: 0,
    targetPerWeek: 2,
    hierarchyAreaId: 'skill',
    triadArea: 'technical',
    requiresAnyOf: CLIMBABLE_EQUIPMENT,
    minTierIndex: 0,
  },
  {
    id: 'maxStrength',
    label: 'Max strength',
    description:
      'Near-limit finger and pull strength — max hangs, limit boulders, hypergravity work. Short, hard, fully rested efforts.',
    intensity: 'high',
    maxPerWeek: 2,
    minDaysBetween: 2,
    targetPerWeek: 2,
    hierarchyAreaId: 'maxStrengthPower',
    triadArea: 'physical',
    requiresAnyOf: ['hangboard', 'boulder-wall', 'steep-wall', 'system-board', 'outdoor-rock'],
    minTierIndex: 1,
  },
  {
    id: 'power',
    label: 'Power',
    description:
      'Explosive, high-velocity work — campusing, big moves, dynos. Highest nervous-system cost of anything you do.',
    intensity: 'high',
    maxPerWeek: 2,
    minDaysBetween: 2,
    targetPerWeek: 1,
    hierarchyAreaId: 'maxStrengthPower',
    triadArea: 'physical',
    requiresAnyOf: ['campus-board', 'boulder-wall', 'steep-wall', 'system-board', 'outdoor-rock'],
    minTierIndex: 1,
  },
  {
    id: 'powerEndurance',
    label: 'Power endurance',
    description:
      'Sustained hard efforts of 15 s–2 min with short rests — the pump. The least trainable system and the easiest to overcook.',
    intensity: 'high',
    maxPerWeek: 3,
    minDaysBetween: 2,
    targetPerWeek: 2,
    hierarchyAreaId: 'anaerobicEndurance',
    triadArea: 'physical',
    requiresAnyOf: [
      'rope-wall',
      'boulder-wall',
      'steep-wall',
      'system-board',
      'hangboard',
      'outdoor-rock',
    ],
    minTierIndex: 1,
  },
  {
    id: 'enduranceAerobic',
    label: 'Aerobic endurance',
    description:
      'Long, low-intensity climbing (ARC) and aerobic work at RPE 4–6. Builds stamina and speeds recovery; safe to train often.',
    intensity: 'low',
    maxPerWeek: null,
    minDaysBetween: 0,
    targetPerWeek: 2,
    hierarchyAreaId: 'stamina',
    triadArea: 'physical',
    requiresAnyOf: [],
    minTierIndex: 0,
  },
  {
    id: 'conditioning',
    label: 'Antagonist & core',
    description:
      'Rotator cuff, scapular, core, and antagonist work — the injury insurance that lets you keep training hard.',
    intensity: 'low',
    maxPerWeek: 4,
    minDaysBetween: 0,
    targetPerWeek: 2,
    hierarchyAreaId: 'conditioning',
    triadArea: 'physical',
    requiresAnyOf: [],
    minTierIndex: 0,
  },
  {
    id: 'mental',
    label: 'Mental game',
    description:
      'Visualisation, breathing, fall practice, and focus cues — trained on the wall, under real pressure.',
    intensity: 'moderate',
    maxPerWeek: null,
    minDaysBetween: 0,
    targetPerWeek: 1,
    hierarchyAreaId: 'skill',
    triadArea: 'mental',
    requiresAnyOf: CLIMBABLE_EQUIPMENT,
    minTierIndex: 0,
  },
  {
    id: 'rest',
    label: 'Rest',
    description: 'Recovery — where the adaptation actually happens.',
    intensity: 'low',
    maxPerWeek: null,
    minDaysBetween: 0,
    targetPerWeek: 0,
    hierarchyAreaId: 'conditioning',
    triadArea: 'physical',
    requiresAnyOf: [],
    minTierIndex: 0,
  },
];

export const SESSION_FOCUS_BY_ID: Record<SessionFocusId, SessionFocus> = Object.fromEntries(
  SESSION_FOCUSES.map((f) => [f.id, f]),
) as Record<SessionFocusId, SessionFocus>;

/** Focuses that can be prescribed as a day's work (everything but rest). */
export const TRAINABLE_FOCUSES: SessionFocusId[] = SESSION_FOCUSES.filter(
  (f) => f.id !== 'rest',
).map((f) => f.id);

export function sessionFocus(id: SessionFocusId): SessionFocus {
  const focus = SESSION_FOCUS_BY_ID[id];
  if (!focus) throw new Error(`Unknown session focus: ${id}`);
  return focus;
}

/** Order a set of focuses into the correct within-session sequence. */
export function orderByHierarchy(ids: SessionFocusId[]): SessionFocusId[] {
  const order: HierarchyAreaId[] = [
    'skill',
    'maxStrengthPower',
    'anaerobicEndurance',
    'conditioning',
    'stamina',
  ];
  return [...ids].sort(
    (a, b) =>
      order.indexOf(sessionFocus(a).hierarchyAreaId) -
      order.indexOf(sessionFocus(b).hierarchyAreaId),
  );
}

/** True when at least one required item is on hand (or nothing is required). */
export function focusIsPossible(id: SessionFocusId, available: EquipmentId[]): boolean {
  const required = sessionFocus(id).requiresAnyOf;
  return required.length === 0 || required.some((e) => available.includes(e));
}

/** The missing-equipment message, when a focus is out of reach today. */
export function missingEquipmentLabel(id: SessionFocusId): string {
  const required = sessionFocus(id).requiresAnyOf;
  return required.map((e) => EQUIPMENT_LABELS[e]).join(' or ');
}
