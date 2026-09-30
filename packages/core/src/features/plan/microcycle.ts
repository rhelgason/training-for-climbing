/**
 * The microcycle scheduler — the app's understanding of a training *week*.
 *
 * Given what the climber has actually done recently, what they can reach today,
 * and how they feel, this decides which session focuses are **due**, which are
 * merely **available**, and which are **blocked** — each with a reason a human
 * can read.
 *
 * Why this is deterministic code and not a paragraph in an LLM prompt: the rules
 * are all counting problems over recent history ("two max-strength sessions in
 * the last seven days", "48 hours since the last one"). A model asked to hold
 * those in its head will violate them convincingly. So the scheduler decides
 * *what* may be trained, and the AI coach decides *how* — filling in real
 * protocols inside constraints it cannot break.
 *
 * Pure and unit-testable. No I/O.
 */
import { ABILITY_TIERS, type AbilityTier } from '../../content/planning';
import type { TriadArea } from '../../content/types';
import {
  CLIMBABLE_EQUIPMENT,
  focusIsPossible,
  missingEquipmentLabel,
  sessionFocus,
  type EquipmentId,
  type Readiness,
  type SessionFocusId,
  type SessionLength,
  type StyleFocus,
  TRAINABLE_FOCUSES,
  orderByHierarchy,
} from '../../content/trainingContext';
import {
  countFocusInWeek,
  daysSinceAnyLoad,
  daysSinceFocus,
  priorFingerDayRun,
  priorHardDayRun,
  recentLoad,
  type LoadEvent,
} from '../train/load';
import { dayIndex } from '../train/log';
import type { DetectedInjury } from '../train/injury';
import { announcedRestSummary, resolveAnnouncedRests } from '../train/announcedRest';
import type { JournalEntry, TrainingPush } from '../../db/types';

export interface MicrocycleInput {
  /** Applied load, newest first (from `loadHistory`). */
  history: LoadEvent[];
  nowMs: number;
  abilityTier: AbilityTier;
  /** Weakest triad area from the latest assessment, or null if unassessed. */
  weakestArea: TriadArea | null;
  styleFocus: StyleFocus;
  /** How many days a week the climber can train. */
  daysPerWeek: number;
  /**
   * `full-time` (the default) does not rest for the weekly count. `steady`
   * still does, once that count is met and they trained recently.
   */
  trainingPush?: TrainingPush;
  /** Equipment reachable today (today's check-in, else the profile's usual set). */
  equipment: EquipmentId[];
  readiness: Readiness;
  sessionLength: SessionLength;
  /**
   * Focuses the current macrocycle block emphasises, if the climber has planned
   * one. A block emphasis outranks style preference when choosing the day's work.
   */
  blockFocuses?: SessionFocusId[];
  /**
   * Unresolved injury from recent logs. Optional so existing callers keep
   * working; when set it is a hard constraint, not a suggestion.
   */
  injury?: DetectedInjury | null;
  /**
   * Raw entries, so "I'm fully resting tomorrow" can be pinned to the day
   * after it was written and then ignored as a rest trigger. Optional.
   */
  journals?: JournalEntry[];
}

export type FocusStatus = 'due' | 'available' | 'blocked';

export interface FocusVerdict {
  focus: SessionFocusId;
  label: string;
  status: FocusStatus;
  /** Plain-language why, e.g. "Trained yesterday — needs 48 hours between sessions." */
  reason: string;
  /** Sessions of this focus in the rolling 7 days. */
  usedThisWeek: number;
  maxPerWeek: number | null;
  targetPerWeek: number;
  /** Days since it was last trained, or null if never. */
  daysSince: number | null;
  /** Ranking score; higher wins the day. Only meaningful for non-blocked focuses. */
  priority: number;
}

/**
 * Why a rest day was called.
 *
 * The distinction matters at the point of use: `recovery` is physiology and the
 * app should hold the line, while `budget` is a promise the climber made to
 * themselves. Someone standing in the gym on their fourth day deserves "this is
 * over the 3 days you planned for" plus a light option — not to be sent home.
 */
export type RestKind = 'recovery' | 'budget';

export interface Microcycle {
  /** True when today should be a rest day, whatever the climber can reach. */
  restDay: boolean;
  /** Why it's a rest day (only set when `restDay`). */
  restReason?: string;
  /** Whether rest is physiological or a self-imposed weekly budget. */
  restKind?: RestKind;
  /**
   * A low-intensity focus that would still be safe today. Offered on a `budget`
   * rest day so showing up anyway isn't a dead end; null on a recovery day,
   * where the whole point is not to train.
   */
  lightAlternative: SessionFocusId | null;
  /** Whole days since the last non-rest day, or null if nothing is logged. */
  daysSinceTraining: number | null;
  /** The headline focus for today, or null on a rest day. */
  primary: SessionFocusId | null;
  /** Additional focuses that fit after the primary, in within-session order. */
  supporting: SessionFocusId[];
  /** Every focus with its verdict, worst-to-best ordered by priority. */
  verdicts: FocusVerdict[];
  /** Training days logged in the rolling 7 days. */
  trainingDaysThisWeek: number;
  /** Consecutive hard days ending today. */
  hardDaysInARow: number;
  /** Consecutive finger-loading days the climber arrives with. */
  fingerDaysInARow: number;
  /** Finger-loading days in the rolling 7, including today if it is already logged. */
  fingerDaysThisWeek: number;
  /**
   * True when the hands are due a break: three days running, or four specific
   * days in the last seven. Today is still a training day — lifting, cardio,
   * and stretching — but nothing that grips a hold.
   */
  offFingers: boolean;
  /**
   * One line explaining how the last few days shaped today — surfaced in the UI
   * and handed to the coach so the advice visibly follows from recent work.
   */
  recentLoadSummary: string;
}

/**
 * Hard days the climber may arrive with. A third near-limit day is not
 * prescribed — Hörst doesn't stack three hard days. The day can still be
 * submaximal climbing until the finger cap below.
 */
export const MAX_CONSECUTIVE_HARD_DAYS = 2;

/**
 * Finger-loading days the climber may arrive with. The next day stays off the
 * wall and the hangboard. Climbing, hangboard, campus, and on-the-wall aerobic
 * all count. Lifting, a run, and stretching do not.
 */
export const MAX_CONSECUTIVE_FINGER_DAYS = 3;

/**
 * Specific finger days in a rolling week. Hörst keeps climbing and hangboard
 * work to about four days; the other days are antagonists, cardio, and mobility.
 */
export const MAX_FINGER_DAYS_PER_WEEK = 4;

const FINGER_FOCUSES: SessionFocusId[] = [
  'skill',
  'maxStrength',
  'power',
  'powerEndurance',
  'enduranceAerobic',
  'mental',
];

/** How many focus blocks fit in a session of each length. */
const BLOCKS_BY_LENGTH: Record<SessionLength, number> = { quick: 1, standard: 2, long: 3 };

/** Style preference nudges, applied as a priority bonus. */
const STYLE_BONUS: Record<StyleFocus, Partial<Record<SessionFocusId, number>>> = {
  'boulder-power': { maxStrength: 2, power: 2, skill: 1 },
  'sport-endurance': { powerEndurance: 2, enduranceAerobic: 2, skill: 1 },
  'all-round': { skill: 1 },
  'trad-alpine': { enduranceAerobic: 2, mental: 2, skill: 1 },
};

function tierIndex(tier: AbilityTier): number {
  return Math.max(
    0,
    ABILITY_TIERS.findIndex((t) => t.id === tier),
  );
}

function describeDaysSince(daysSince: number | null): string {
  if (daysSince === null) return 'not trained recently';
  if (daysSince === 0) return 'trained today';
  if (daysSince === 1) return 'trained yesterday';
  return `last trained ${daysSince} days ago`;
}

/**
 * Evaluate one focus against every gate: equipment, ability, weekly ceiling,
 * recovery gap, and how the climber feels. The first gate that fails wins the
 * reason — they're ordered so the most actionable explanation surfaces.
 */
function evaluate(
  focus: SessionFocusId,
  input: MicrocycleInput,
  limits: { hardDaysInARow: number; fingerDaysInARow: number; offFingers: boolean },
): FocusVerdict {
  const spec = sessionFocus(focus);
  const usedThisWeek = countFocusInWeek(input.history, focus, input.nowMs);
  const daysSince = daysSinceFocus(input.history, focus, input.nowMs);
  const base: Omit<FocusVerdict, 'status' | 'reason' | 'priority'> = {
    focus,
    label: spec.label,
    usedThisWeek,
    maxPerWeek: spec.maxPerWeek,
    targetPerWeek: spec.targetPerWeek,
    daysSince,
  };
  const blocked = (reason: string): FocusVerdict => ({
    ...base,
    status: 'blocked',
    reason,
    priority: -1,
  });

  if (!focusIsPossible(focus, input.equipment)) {
    return blocked(`Not available today — needs ${missingEquipmentLabel(focus)}.`);
  }
  if (tierIndex(input.abilityTier) < spec.minTierIndex) {
    return blocked('Save this until your base of climbing mileage is bigger.');
  }
  if (input.injury?.noClimbing) {
    const loadsClimbing =
      spec.requiresAnyOf.length > 0 &&
      spec.requiresAnyOf.some(
        (e) => CLIMBABLE_EQUIPMENT.includes(e) || e === 'hangboard' || e === 'campus-board',
      );
    if (loadsClimbing) {
      return blocked(`Logged injury — ${input.injury.summary}`);
    }
  }
  if (
    (input.injury?.noHighIntensity || input.readiness === 'tweaky') &&
    spec.intensity === 'high'
  ) {
    return blocked(
      input.injury
        ? `Logged issue — no near-limit loading. ${input.injury.summary}`
        : 'Something hurts — no near-limit loading until it settles.',
    );
  }
  if (input.readiness === 'tired' && spec.intensity === 'high') {
    return blocked('You reported feeling tired — hard efforts today would be low quality.');
  }
  if (limits.offFingers && FINGER_FOCUSES.includes(focus)) {
    const why =
      limits.fingerDaysInARow >= MAX_CONSECUTIVE_FINGER_DAYS
        ? `Fingers loaded ${limits.fingerDaysInARow} days running — no fourth day on the hands.`
        : `Fingers already loaded ${MAX_FINGER_DAYS_PER_WEEK} days in the last 7 — specific work stays there.`;
    return blocked(`${why} Lift, do cardio, or stretch instead.`);
  }
  if (limits.hardDaysInARow >= MAX_CONSECUTIVE_HARD_DAYS && spec.intensity === 'high') {
    return blocked(
      `Already ${limits.hardDaysInARow} hard days in a row. No near-limit work today.`,
    );
  }
  if (
    spec.maxPerWeek !== null &&
    usedThisWeek >= spec.maxPerWeek &&
    !(focus === 'conditioning' && limits.offFingers)
  ) {
    return blocked(
      `Already ${usedThisWeek} of ${spec.maxPerWeek} this week — more would cost more than it gains.`,
    );
  }
  if (daysSince !== null && daysSince < spec.minDaysBetween) {
    const hours = spec.minDaysBetween * 24;
    return blocked(
      `${capitalise(describeDaysSince(daysSince))} — needs ${hours} hours between sessions.`,
    );
  }

  // Available. Score it: quota debt first, then weakness, block, and style.
  const debt = Math.max(0, spec.targetPerWeek - usedThisWeek);
  let priority = debt * 3;
  // The weakest area is where training pays best, so it must outrank the
  // default pull toward skill work; a planned block outranks even that.
  if (input.weakestArea && spec.triadArea === input.weakestArea) priority += 6;
  if (input.blockFocuses?.includes(focus)) priority += 5;
  priority += STYLE_BONUS[input.styleFocus][focus] ?? 0;
  // Freshness tiebreak: nudge toward whatever has waited longest.
  priority += Math.min(daysSince ?? 7, 7) * 0.2;

  const status: FocusStatus = debt > 0 ? 'due' : 'available';
  const reason =
    debt > 0
      ? `Due — ${usedThisWeek} of ${spec.targetPerWeek} this week, ${describeDaysSince(daysSince)}.`
      : `Weekly target met (${usedThisWeek}/${spec.targetPerWeek}) — optional today.`;
  return { ...base, status, reason, priority };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A human sentence about what the last few days did, for the UI and the coach.
 * A long gap is stated outright: coming back after a week off should read as
 * "you're fresh", not as silence.
 */
function summariseRecentLoad(input: MicrocycleInput, daysSince: number | null): string {
  const today = dayIndex(input.nowMs);
  const recent = recentLoad(input.history, input.nowMs, 5).filter((e) => e.day < today);
  if (recent.length === 0) {
    return daysSince === null
      ? 'No training logged yet.'
      : `Nothing logged in the last few days — you should be well recovered.`;
  }
  const parts = recent.slice(0, 3).map((event) => {
    const when = today - event.day === 1 ? 'Yesterday' : `${today - event.day} days ago`;
    const what = event.focuses
      .filter((f) => f !== 'rest')
      .map((f) => sessionFocus(f).label.toLowerCase());
    return what.length === 0
      ? `${when}: rest`
      : `${when}: ${what.join(' + ')} (${event.intensity})`;
  });
  const gap =
    daysSince !== null && daysSince >= 3
      ? ` You haven't trained in ${daysSince} days, so you're starting fresh.`
      : '';
  return parts.join('; ') + '.' + gap;
}

/** The gentlest thing still on the table, for a "you're here anyway" offer. */
function pickLightAlternative(verdicts: FocusVerdict[]): SessionFocusId | null {
  const light = verdicts
    .filter((v) => v.status !== 'blocked' && sessionFocus(v.focus).intensity !== 'high')
    .sort((a, b) => b.priority - a.priority);
  return light.length > 0 ? light[0].focus : null;
}

/**
 * Decide today. Ordering matters: whole-day rest rules are checked before any
 * per-focus scoring, because no amount of "power is due" outranks a body that
 * has been hammered for three days.
 */
export function buildMicrocycle(input: MicrocycleInput): Microcycle {
  // The runs the climber *arrives with*, not ones that include today — today is
  // the thing being decided and is usually not logged yet.
  const hardDaysInARow = priorHardDayRun(input.history, input.nowMs);
  const fingerDaysInARow = priorFingerDayRun(input.history, input.nowMs);
  const week = recentLoad(input.history, input.nowMs, 7);
  const fingerDaysThisWeek = week.filter((e) => e.loadsFingers).length;
  // A rest yesterday already broke the run. Do not spend today on another day
  // off the wall just because earlier days in the week were on the hands.
  const today = dayIndex(input.nowMs);
  const yesterdayLoadedFingers = input.history.some(
    (event) => event.day === today - 1 && event.loadsFingers,
  );
  const offFingers =
    fingerDaysInARow >= MAX_CONSECUTIVE_FINGER_DAYS ||
    (fingerDaysThisWeek >= MAX_FINGER_DAYS_PER_WEEK && yesterdayLoadedFingers);
  const verdicts = TRAINABLE_FOCUSES.map((focus) =>
    evaluate(focus, input, { hardDaysInARow, fingerDaysInARow, offFingers }),
  ).sort((a, b) => b.priority - a.priority);
  const trainingDaysThisWeek = week.filter((e) => !e.focuses.every((f) => f === 'rest')).length;
  const daysSinceTraining = daysSinceAnyLoad(input.history, input.nowMs);
  const announced = resolveAnnouncedRests(input.journals ?? [], input.history, input.nowMs);
  const announcedNote = announcedRestSummary(announced);
  const baseSummary = announcedNote
    ? `${summariseRecentLoad(input, daysSinceTraining)} ${announcedNote}`
    : summariseRecentLoad(input, daysSinceTraining);
  // Injury and "something hurts" stay a real rest, even if the hands were also due off.
  const fingerNote = offFingers
    ? fingerDaysInARow >= MAX_CONSECUTIVE_FINGER_DAYS
      ? ` Fingers loaded ${fingerDaysInARow} days running, so today stays off the wall: lifting, cardio, and stretching.`
      : ` Fingers loaded ${fingerDaysThisWeek} days in the last 7, so today stays off the wall: lifting, cardio, and stretching.`
    : '';

  const rest = (restReason: string, restKind: RestKind): Microcycle => ({
    restDay: true,
    restReason,
    restKind,
    lightAlternative: restKind === 'budget' ? pickLightAlternative(verdicts) : null,
    primary: null,
    supporting: [],
    verdicts,
    trainingDaysThisWeek,
    hardDaysInARow,
    fingerDaysInARow,
    fingerDaysThisWeek,
    offFingers: false,
    daysSinceTraining,
    recentLoadSummary: baseSummary,
  });

  const loggedInjury = input.injury;
  if (loggedInjury?.noClimbing || loggedInjury?.severity === 'severe') {
    return rest(loggedInjury.summary, 'recovery');
  }
  if (input.readiness === 'tweaky') {
    return rest(
      'You flagged that something hurts. Train around it or take the day — a small tweak ignored becomes a long layoff.',
      'recovery',
    );
  }
  // A third hard day is already blocked above (no near-limit work). Three days
  // on the fingers does not send anyone home: the hands come off, and the
  // session is lifting, cardio, and stretching. A named rest is context, not a
  // day off. The summary above already says not to honour it again.
  // Steady climbers still rest once the week they planned is done, and only
  // when they have not already had a day off. Full-time skips that budget:
  // the count is a target, not a ceiling.
  const push = input.trainingPush ?? 'full-time';
  if (
    !offFingers &&
    push === 'steady' &&
    trainingDaysThisWeek >= input.daysPerWeek &&
    (daysSinceTraining ?? 0) < 2
  ) {
    return rest(
      `That's ${trainingDaysThisWeek} training days in the last 7, the ${input.daysPerWeek} you planned for. Resting is the plan working — but you know your week best.`,
      'budget',
    );
  }

  const usable = verdicts.filter((v) => v.status !== 'blocked');
  if (usable.length === 0) {
    return rest(
      'Nothing you can train today is both available and recovered. Rest up.',
      'recovery',
    );
  }

  const primary = usable[0].focus;
  const blocks = BLOCKS_BY_LENGTH[input.sessionLength];
  const supporting = orderByHierarchy(
    usable
      .slice(1)
      // Never stack two high-intensity focuses in one day — quality collapses.
      .filter((v) => sessionFocus(v.focus).intensity !== 'high')
      .slice(0, Math.max(0, blocks - 1))
      .map((v) => v.focus),
  );

  return {
    restDay: false,
    lightAlternative: null,
    primary,
    supporting,
    verdicts,
    trainingDaysThisWeek,
    hardDaysInARow,
    fingerDaysInARow,
    fingerDaysThisWeek,
    offFingers,
    daysSinceTraining,
    recentLoadSummary: baseSummary + fingerNote,
  };
}

/** The focuses the coach is allowed to prescribe today, in session order. */
export function allowedFocuses(cycle: Microcycle): SessionFocusId[] {
  if (cycle.restDay) return [];
  return orderByHierarchy(cycle.verdicts.filter((v) => v.status !== 'blocked').map((v) => v.focus));
}

/** The focuses the coach must not prescribe, with the reason for each. */
export function blockedFocuses(cycle: Microcycle): { focus: SessionFocusId; reason: string }[] {
  return cycle.verdicts
    .filter((v) => v.status === 'blocked')
    .map((v) => ({ focus: v.focus, reason: v.reason }));
}
