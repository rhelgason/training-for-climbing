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
  consecutiveHardDays,
  countFocusInWeek,
  daysSinceFocus,
  recentLoad,
  type LoadEvent,
} from '../train/load';
import { dayIndex } from '../train/log';

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
  /** Equipment reachable today (today's check-in, else the profile's usual set). */
  equipment: EquipmentId[];
  readiness: Readiness;
  sessionLength: SessionLength;
  /**
   * Focuses the current macrocycle block emphasises, if the climber has planned
   * one. A block emphasis outranks style preference when choosing the day's work.
   */
  blockFocuses?: SessionFocusId[];
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

export interface Microcycle {
  /** True when today should be a rest day, whatever the climber can reach. */
  restDay: boolean;
  /** Why it's a rest day (only set when `restDay`). */
  restReason?: string;
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
  /**
   * One line explaining how the last few days shaped today — surfaced in the UI
   * and handed to the coach so the advice visibly follows from recent work.
   */
  recentLoadSummary: string;
}

/** Hard days in a row at which the body needs a break regardless of the week's plan. */
export const MAX_CONSECUTIVE_HARD_DAYS = 3;

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
function evaluate(focus: SessionFocusId, input: MicrocycleInput): FocusVerdict {
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
  if (input.readiness === 'tweaky' && spec.intensity === 'high') {
    return blocked('Something hurts — no near-limit loading until it settles.');
  }
  if (input.readiness === 'tired' && spec.intensity === 'high') {
    return blocked('You reported feeling tired — hard efforts today would be low quality.');
  }
  if (spec.maxPerWeek !== null && usedThisWeek >= spec.maxPerWeek) {
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

/** A human sentence about what the last few days did, for the UI and the coach. */
function summariseRecentLoad(input: MicrocycleInput): string {
  const recent = recentLoad(input.history, input.nowMs, 4).filter(
    (e) => e.day < dayIndex(input.nowMs),
  );
  if (recent.length === 0) return 'No training logged in the last few days.';
  const today = dayIndex(input.nowMs);
  const parts = recent.slice(0, 3).map((event) => {
    const when = today - event.day === 1 ? 'Yesterday' : `${today - event.day} days ago`;
    const what = event.focuses
      .filter((f) => f !== 'rest')
      .map((f) => sessionFocus(f).label.toLowerCase());
    return what.length === 0
      ? `${when}: rest`
      : `${when}: ${what.join(' + ')} (${event.intensity})`;
  });
  return parts.join('; ') + '.';
}

/**
 * Decide today. Ordering matters: whole-day rest rules are checked before any
 * per-focus scoring, because no amount of "power is due" outranks a body that
 * has been hammered for three days.
 */
export function buildMicrocycle(input: MicrocycleInput): Microcycle {
  const verdicts = TRAINABLE_FOCUSES.map((focus) => evaluate(focus, input)).sort(
    (a, b) => b.priority - a.priority,
  );
  const week = recentLoad(input.history, input.nowMs, 7);
  const trainingDaysThisWeek = week.filter((e) => !e.focuses.every((f) => f === 'rest')).length;
  const hardDaysInARow = consecutiveHardDays(input.history, input.nowMs);
  const recentLoadSummary = summariseRecentLoad(input);

  const rest = (restReason: string): Microcycle => ({
    restDay: true,
    restReason,
    primary: null,
    supporting: [],
    verdicts,
    trainingDaysThisWeek,
    hardDaysInARow,
    recentLoadSummary,
  });

  if (input.readiness === 'tweaky') {
    return rest(
      'You flagged that something hurts. Train around it or take the day — a small tweak ignored becomes a long layoff.',
    );
  }
  if (hardDaysInARow >= MAX_CONSECUTIVE_HARD_DAYS) {
    return rest(
      `You've trained hard ${hardDaysInARow} days running. Rest is when the adaptation actually happens.`,
    );
  }
  if (trainingDaysThisWeek >= input.daysPerWeek) {
    return rest(
      `You've already trained ${trainingDaysThisWeek} days this week, which is the ${input.daysPerWeek} you planned for. Take the recovery.`,
    );
  }

  const usable = verdicts.filter((v) => v.status !== 'blocked');
  if (usable.length === 0) {
    return rest('Nothing you can train today is both available and recovered. Rest up.');
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
    primary,
    supporting,
    verdicts,
    trainingDaysThisWeek,
    hardDaysInARow,
    recentLoadSummary,
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
