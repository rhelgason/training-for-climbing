/**
 * Planning content — Eric J. Hörst, *Training for Climbing* (3rd ed.).
 * Goal-setting (Chapter 2) and program design / periodization (Chapter 10).
 */

// --- Goals (Chapter 2) ---

export type GoalHorizon = 'short' | 'medium' | 'long';

export interface GoalHorizonInfo {
  id: GoalHorizon;
  label: string;
  timeframe: string;
  description: string;
}

export const GOAL_HORIZONS: GoalHorizonInfo[] = [
  {
    id: 'short',
    label: 'Short-term',
    timeframe: 'daily',
    description:
      'Your daily game plan — the mission and focus for a single workout or climbing day.',
  },
  {
    id: 'medium',
    label: 'Medium-term',
    timeframe: 'weeks–months',
    description:
      'Shape for the next few weeks or months — a redpoint target, a trip, a fitness gain.',
  },
  {
    id: 'long',
    label: 'Long-term',
    timeframe: 'yearly · "mega"',
    description: 'The big "I wish" goals — an ultimate grade, a dream send, a mountain to summit.',
  },
];

export const GOAL_HORIZON_LABELS: Record<GoalHorizon, string> = {
  short: 'Short-term',
  medium: 'Medium-term',
  long: 'Long-term',
};

/** A selectable deadline length for a goal. `days: null` means open-ended. */
export interface GoalDeadlineOption {
  id: string;
  label: string;
  days: number | null;
}

/**
 * Deadline choices scoped to each horizon, so the time options match the scale of
 * the goal: short-term is days/weeks, medium-term is months, long-term is years.
 */
export const GOAL_DEADLINE_OPTIONS: Record<GoalHorizon, GoalDeadlineOption[]> = {
  short: [
    { id: 'none', label: 'No deadline', days: null },
    { id: '1d', label: '1 day', days: 1 },
    { id: '1w', label: '1 week', days: 7 },
  ],
  medium: [
    { id: 'none', label: 'No deadline', days: null },
    { id: '1m', label: '1 month', days: 30 },
    { id: '3m', label: '3 months', days: 90 },
    { id: '6m', label: '6 months', days: 180 },
  ],
  long: [
    { id: 'none', label: 'Lifetime', days: null },
    { id: '1y', label: '1 year', days: 365 },
    { id: '2y', label: '2 years', days: 730 },
    { id: '5y', label: '5 years', days: 1825 },
  ],
};

export type GoalStatus = 'active' | 'done' | 'archived';

// --- Program design / periodization (Chapter 10) ---

/**
 * Ability tiers drive how training time is split three ways, per the book's
 * time-allocation figures (Figs 10.5–10.7): actual climbing vs. climbing-specific
 * strength training vs. general conditioning. The three percentages sum to 100.
 */
export type AbilityTier = 'beginner' | 'intermediate' | 'elite';

export interface AbilityTierInfo {
  id: AbilityTier;
  label: string;
  /** Suggested % of time spent actually climbing (skill, tactics, mileage). */
  climbingPct: number;
  /** Suggested % of time on climbing-specific strength (fingers, pull, power). */
  specificStrengthPct: number;
  /** Suggested % of time on general conditioning (mobility, core, antagonist, aerobic). */
  generalConditioningPct: number;
  guidance: string;
  /**
   * The grade at which a climber is generally working in this tier, as a
   * consolidated level rather than a best-ever send. Used to notice when
   * someone has outgrown the tier they signed up with.
   *
   * Source (maintainers only): Eric J. Hörst, *Training for Climbing* (3rd ed.)
   * — the ability-tier discussion in Ch. 2.
   */
  boulderFloor: string;
  routeFloor: string;
}

export const ABILITY_TIERS: AbilityTierInfo[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    boulderFloor: 'VB',
    routeFloor: '5.5',
    climbingPct: 75,
    specificStrengthPct: 5,
    generalConditioningPct: 20,
    guidance:
      'Almost all gains come from climbing skill and the mental game. Spend the bulk of your time learning movement, with only light climbing-specific strength work.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    boulderFloor: 'V3',
    routeFloor: '5.10a',
    climbingPct: 60,
    specificStrengthPct: 30,
    generalConditioningPct: 10,
    guidance:
      'Actual climbing still dominates, but climbing-specific strength (fingers, pull, power) now earns a real share of your time.',
  },
  {
    id: 'elite',
    label: 'Elite',
    boulderFloor: 'V7',
    routeFloor: '5.12a',
    climbingPct: 50,
    specificStrengthPct: 40,
    generalConditioningPct: 10,
    guidance:
      'With highly honed skills, split your time roughly evenly between climbing and maximizing sport-specific strength, power, and anaerobic endurance.',
  },
];

export const ABILITY_TIER_LABELS: Record<AbilityTier, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  elite: 'Elite',
};

/**
 * The optimal within-session training order (after warm-up). Training out of
 * this order compromises quality and results.
 */
export type HierarchyAreaId =
  | 'skill'
  | 'maxStrengthPower'
  | 'anaerobicEndurance'
  | 'conditioning'
  | 'stamina';

export interface HierarchyArea {
  id: HierarchyAreaId;
  /** 1-based position in the session order. */
  order: number;
  name: string;
  description: string;
}

export const TRAINING_HIERARCHY: HierarchyArea[] = [
  {
    id: 'skill',
    order: 1,
    name: 'Skill & strategy',
    description: 'Actual climbing to learn movement, tactics, and technique — done fresh, first.',
  },
  {
    id: 'maxStrengthPower',
    order: 2,
    name: 'Max strength & power',
    description: 'Climbing and exercises that target maximum finger strength and upper-body power.',
  },
  {
    id: 'anaerobicEndurance',
    order: 3,
    name: 'Anaerobic endurance',
    description: 'Interval climbing and exercises that build power endurance / muscular endurance.',
  },
  {
    id: 'conditioning',
    order: 4,
    name: 'Antagonist & core',
    description: 'Antagonist-muscle, core, and other general conditioning exercises.',
  },
  {
    id: 'stamina',
    order: 5,
    name: 'Aerobic stamina',
    description: 'Aerobic training (e.g. running) to improve overall stamina and recovery.',
  },
];

/** Rest guidance from the microcycle discussion (Chapter 10). */
export const REST_GUIDANCE = {
  strengthPowerSkill:
    'Rest 3+ minutes between sets/climbs when training skill, max strength, or power — quality over fatigue.',
  anaerobicEndurance:
    'Rest under 1–2 minutes between climbs to drive a pump and train anaerobic (power) endurance.',
  betweenWorkouts:
    'Leave adequate rest days between hard workouts — err on the side of more rest than you think you need.',
} as const;
