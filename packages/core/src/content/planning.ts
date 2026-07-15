/**
 * Planning content — Eric J. Hörst, *Training for Climbing* (3rd ed.).
 * Goal-setting (Chapter 2) and program design / periodization (Chapter 8).
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

// --- Program design / periodization (Chapter 8) ---

/** Ability tiers drive how training time is split (technique/mental vs. conditioning). */
export type AbilityTier = 'beginner' | 'intermediate' | 'elite';

export interface AbilityTierInfo {
  id: AbilityTier;
  label: string;
  /** Suggested % of training time on technique, tactics, and the mental game. */
  techniqueMentalPct: number;
  /** Suggested % of training time on general + sport-specific conditioning. */
  conditioningPct: number;
  guidance: string;
}

export const ABILITY_TIERS: AbilityTierInfo[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    techniqueMentalPct: 70,
    conditioningPct: 30,
    guidance:
      'Most gains come from climbing skill and the mental game. Spend the bulk of your time learning movement; keep conditioning light.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    techniqueMentalPct: 70,
    conditioningPct: 30,
    guidance:
      'Technique and tactics still dominate, but begin layering in more structured strength and endurance work.',
  },
  {
    id: 'elite',
    label: 'Elite',
    techniqueMentalPct: 40,
    conditioningPct: 60,
    guidance:
      'With highly honed skills, more time is well spent maximizing strength, power, and anaerobic endurance.',
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

/** Rest guidance from the microcycle discussion (Chapter 8). */
export const REST_GUIDANCE = {
  strengthPowerSkill:
    'Rest 3+ minutes between sets/climbs when training skill, max strength, or power — quality over fatigue.',
  anaerobicEndurance:
    'Rest under 1–2 minutes between climbs to drive a pump and train anaerobic (power) endurance.',
  betweenWorkouts:
    'Leave adequate rest days between hard workouts — err on the side of more rest than you think you need.',
} as const;
