/**
 * "What should I do today?" — the deterministic daily plan.
 *
 * This always runs: offline, before sign-in, and whenever the AI coach is
 * unavailable. It composes two pieces:
 *
 *  - the **microcycle scheduler**, which decides *what* may be trained today
 *    given recent load, weekly frequencies, equipment, and readiness; and
 *  - the **exercise library and drill prescriptions**, which turn the chosen
 *    focus into concrete, ordered steps filtered to the gear on hand.
 *
 * The AI coach replaces the *steps*, never the scheduler's verdict — so both
 * paths obey the same recovery rules.
 *
 * Rules, each grounded in the training literature:
 *  - Hard days in a row, or a full week's quota, means rest.
 *  - Otherwise target the weakest triad area; that's where training pays best.
 *  - Take the assessment first if none exists — it drives everything.
 *  - Train in hierarchy order within a session: skill → max strength/power →
 *    anaerobic endurance → conditioning → stamina.
 *  - Keep active short/medium-term goals in view.
 */
import type { ClimbDiscipline } from '../../content/climbing';
import {
  DEFAULT_EQUIPMENT,
  sessionFocus,
  type EquipmentId,
  type Readiness,
  type SessionFocusId,
  type SessionLength,
  type StyleFocus,
} from '../../content/trainingContext';
import { TRIAD_LABELS, type TriadArea } from '../../content/types';
import type { AbilityTier } from '../../content/planning';
import type {
  BenchmarkRecord,
  ClimbRecord,
  DerivedNote,
  GoalRecord,
  JournalEntry,
} from '../../db/types';
import { activeGoals } from '../plan/goals';
import { buildMicrocycle, type Microcycle, type RestKind } from '../plan/microcycle';
import { detectInjury, type DetectedInjury } from '../train/injury';
import { loadHistory, type LoadEvent } from '../train/load';
import { prescribeClimbing, type ClimbingPrescription } from './climbingPrescription';
import { currentStreak, dayIndex, priorTrainingRun, restRecommended } from '../train/log';
import {
  buildSessionSteps,
  restSteps,
  type PlanStep,
  type SessionPlanContext,
} from './sessionPlan';

export type { PlanStep } from './sessionPlan';

export interface DailyInput {
  /** Weakest triad area from the latest assessment, or null if none taken. */
  weakestArea: TriadArea | null;
  /** Specific low-rated statements in the weakest area, worst-first (optional). */
  weakSpots?: string[];
  goals: GoalRecord[];
  /** Epoch-ms dates that count as training (journals + climbs). */
  trainingDates: number[];
  nowMs: number;

  // --- Context. All optional so older callers keep working unchanged. ---

  /** Classified recent load. Without it the scheduler is skipped entirely. */
  history?: LoadEvent[];
  abilityTier?: AbilityTier;
  styleFocus?: StyleFocus;
  daysPerWeek?: number;
  /** Equipment available today. Defaults to a typical gym. */
  equipment?: EquipmentId[];
  readiness?: Readiness;
  sessionLength?: SessionLength;
  blockFocuses?: SessionFocusId[];

  /**
   * Logged protocol numbers. With them, a fingerboard step carries the weight
   * to use today instead of naming the exercise and leaving the load to guesswork;
   * without them it prescribes a test session to establish one.
   */
  benchmarks?: BenchmarkRecord[];
  /** Logged climbs, used to pitch today's grades against the climber's own pyramid. */
  climbs?: ClimbRecord[];
  /** Which scale to prescribe grades on. Defaults to bouldering. */
  discipline?: ClimbDiscipline;

  /**
   * Recent journals and free-text context. Used only to detect an unresolved
   * injury — they are never written back. Optional so older callers keep working.
   */
  journals?: JournalEntry[];
  dailyNote?: string;
  climberContext?: string;
  derivedNotes?: Array<Pick<DerivedNote, 'text'> | string>;
}

export type DailyKind = 'rest' | 'assess' | 'train';

export interface DailyRecommendation {
  kind: DailyKind;
  streak: number;
  headline: string;
  detail: string;
  focusArea: TriadArea | null;
  /** Concrete, ordered steps for today (warm-up → work → cool-down). */
  plan: string[];
  /** The same steps with exercise/protocol provenance, for inline logging. */
  steps: PlanStep[];
  /** Specific weak-spot statements to target today (from the assessment). */
  focusItems: string[];
  /** Titles of active short/medium-term goals to keep in mind. */
  goalReminders: string[];
  /** The session focus this plan trains, when the scheduler ran. */
  focus: SessionFocusId | null;
  /** Supporting focuses squeezed in after the primary work. */
  supportingFocuses: SessionFocusId[];
  /**
   * Why today looks like this, in one line — the recent sessions that shaped it.
   * Empty when there's no history to reason from.
   */
  because: string;
  /** The scheduler's full working, for the UI's "why" panel and the coach. */
  microcycle: Microcycle | null;
  /**
   * On a rest day, whether it's physiological or a self-imposed weekly budget.
   * Null when it isn't a rest day.
   */
  restKind: RestKind | null;
  /**
   * A gentler session offered when rest is only a budget call, so a climber
   * already standing in the gym has somewhere to go. Null on recovery days,
   * where not training is the entire point.
   */
  lightAlternative: { focus: SessionFocusId; label: string; plan: string[] } | null;
  /**
   * Which grades to climb today and in what style, derived from the climber's
   * own send pyramid. Null on rest and assessment days, where there's nothing
   * to pitch.
   */
  climbing: ClimbingPrescription | null;
  /** Unresolved injury detected from recent logs, if any. */
  injury: DetectedInjury | null;
}

const FOCUS_DETAIL: Record<TriadArea, string> = {
  mental:
    'Your weakest area is the mental game. Climb for practice and work mental skills — visualization, breathing, and focus.',
  technical:
    'Your weakest area is technique. Prioritise deliberate skill practice — footwork and movement — on climbs within your limit.',
  physical:
    'Your weakest area is physical. After a full warm-up, train in hierarchy order: skill → max strength/power → endurance → conditioning.',
};

const ASSESS_STEPS: PlanStep[] = [
  { text: 'Open Assess and complete the 30-question self-assessment.' },
  { text: 'Note your weakest triad area — it becomes the focus of your daily plan.' },
];

function planContext(
  input: DailyInput,
  climbing: ClimbingPrescription | null,
  injury: DetectedInjury | null,
): SessionPlanContext {
  return {
    dayIdx: dayIndex(input.nowMs),
    equipment: input.equipment ?? DEFAULT_EQUIPMENT,
    benchmarks: input.benchmarks ?? [],
    nowMs: input.nowMs,
    abilityTier: input.abilityTier ?? 'intermediate',
    sessionLength: input.sessionLength ?? 'standard',
    climbing,
    injury,
  };
}

function legacyPlan(area: TriadArea, ctx: SessionPlanContext): PlanStep[] {
  if (ctx.injury?.noHighIntensity) {
    if (area === 'mental') return buildSessionSteps('mental', ['conditioning'], ctx);
    return buildSessionSteps('skill', ['conditioning'], ctx);
  }
  if (area === 'physical') {
    return buildSessionSteps('maxStrength', ['conditioning'], ctx);
  }
  return buildSessionSteps(area === 'mental' ? 'mental' : 'skill', ['conditioning'], ctx);
}

/** The display/AI surface derived from the structured steps — one source of truth. */
function texts(steps: PlanStep[]): string[] {
  return steps.map((s) => s.text);
}

function goalReminders(goals: GoalRecord[]): string[] {
  return activeGoals(goals)
    .filter((g) => g.horizon === 'short' || g.horizon === 'medium')
    .slice(0, 3)
    .map((g) => g.title);
}

export function buildDailyRecommendation(input: DailyInput): DailyRecommendation {
  const streak = currentStreak(input.trainingDates, input.nowMs);
  const reminders = goalReminders(input.goals);
  const equipment = input.equipment ?? DEFAULT_EQUIPMENT;
  const injury = detectInjury({
    journals: input.journals ?? [],
    nowMs: input.nowMs,
    dailyNote: input.dailyNote,
    climberContext: input.climberContext,
    derivedNotes: input.derivedNotes,
  });

  // The scheduler needs classified history; without it we fall back to the
  // simpler streak-based logic so existing callers behave exactly as before.
  const cycle: Microcycle | null = input.history
    ? buildMicrocycle({
        history: input.history,
        nowMs: input.nowMs,
        abilityTier: input.abilityTier ?? 'intermediate',
        weakestArea: input.weakestArea,
        styleFocus: input.styleFocus ?? 'all-round',
        daysPerWeek: input.daysPerWeek ?? 3,
        equipment,
        readiness: input.readiness ?? 'ok',
        sessionLength: input.sessionLength ?? 'standard',
        blockFocuses: input.blockFocuses,
        injury,
      })
    : null;

  const because = cycle?.recentLoadSummary ?? '';
  const common = {
    streak,
    focusItems: [] as string[],
    goalReminders: reminders,
    focus: null as SessionFocusId | null,
    supportingFocuses: [] as SessionFocusId[],
    because,
    microcycle: cycle,
    restKind: null as RestKind | null,
    lightAlternative: null as DailyRecommendation['lightAlternative'],
    climbing: null as ClimbingPrescription | null,
    injury,
  };

  // Note `priorTrainingRun`, not `streak`: the question is what they arrive
  // with, and today is usually unlogged when the plan is read.
  const needsRest = cycle
    ? cycle.restDay
    : injury?.noClimbing || restRecommended(priorTrainingRun(input.trainingDates, input.nowMs));
  if (needsRest) {
    const restPlan = restSteps(injury);
    const alternativeFocus = cycle?.lightAlternative ?? null;
    const altCtx = planContext(input, null, injury);
    const alternativeSteps = alternativeFocus
      ? buildSessionSteps(alternativeFocus, [], altCtx)
      : [];
    return {
      ...common,
      kind: 'rest',
      headline: injury?.noClimbing ? 'Rest — injury first' : 'Take a rest day',
      detail:
        (injury ? `${injury.summary} ` : '') +
        (cycle?.restReason ??
          `You've trained ${streak} days in a row. Training 3–4 days straight risks overtraining — rest is when your body actually gets stronger.`),
      focusArea: null,
      plan: texts(restPlan),
      steps: restPlan,
      restKind: cycle?.restKind ?? 'recovery',
      lightAlternative:
        alternativeFocus && alternativeSteps.length > 0 && !injury?.noClimbing
          ? {
              focus: alternativeFocus,
              label: sessionFocus(alternativeFocus).label,
              plan: texts(alternativeSteps),
            }
          : null,
    };
  }

  if (input.weakestArea === null) {
    return {
      ...common,
      kind: 'assess',
      headline: 'Start with a self-assessment',
      detail:
        'Take the 30-question self-assessment so the app can target your weakest area of the performance triad.',
      focusArea: null,
      plan: texts(ASSESS_STEPS),
      steps: ASSESS_STEPS,
    };
  }

  if (cycle && cycle.primary) {
    const spec = sessionFocus(cycle.primary);
    const climbing = prescribeClimbing(
      input.climbs ?? [],
      input.discipline ?? 'boulder',
      cycle.primary,
      input.nowMs,
    );
    const scheduled = buildSessionSteps(
      cycle.primary,
      cycle.supporting,
      planContext(input, climbing, injury),
    );
    return {
      ...common,
      kind: 'train',
      headline: `Today: ${spec.label}`,
      detail: injury ? `${spec.description} ${injury.summary}` : spec.description,
      focusArea: spec.triadArea,
      plan: texts(scheduled),
      steps: scheduled,
      focusItems: input.weakSpots ?? [],
      focus: cycle.primary,
      supportingFocuses: cycle.supporting,
      climbing,
    };
  }

  const climbing = prescribeClimbing(
    input.climbs ?? [],
    input.discipline ?? 'boulder',
    null,
    input.nowMs,
  );
  const legacy = legacyPlan(input.weakestArea, planContext(input, climbing, injury));
  return {
    ...common,
    kind: 'train',
    headline: `Focus on ${TRIAD_LABELS[input.weakestArea]}`,
    detail: FOCUS_DETAIL[input.weakestArea],
    focusArea: input.weakestArea,
    plan: texts(legacy),
    steps: legacy,
    focusItems: input.weakSpots ?? [],
    climbing,
  };
}

/** Convenience: classify raw records and build the plan in one call. */
export function dailyRecommendationFrom(
  input: Omit<DailyInput, 'history' | 'trainingDates'> & {
    journals: Parameters<typeof loadHistory>[0];
    climbs: Parameters<typeof loadHistory>[1];
    trainingDates: number[];
  },
): DailyRecommendation {
  const { journals, climbs, ...rest } = input;
  return buildDailyRecommendation({
    ...rest,
    climbs,
    journals,
    history: loadHistory(journals, climbs),
  });
}
