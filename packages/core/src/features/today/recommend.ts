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
import { EXERCISES } from '../../content/exercises';
import { PRESCRIPTIONS_BY_AREA } from '../../content/prescriptions';
import {
  DEFAULT_EQUIPMENT,
  sessionFocus,
  type EquipmentId,
  type Readiness,
  type SessionFocusId,
  type SessionLength,
  type StyleFocus,
} from '../../content/trainingContext';
import { TRIAD_LABELS, type Exercise, type TriadArea } from '../../content/types';
import type { AbilityTier } from '../../content/planning';
import type { GoalRecord } from '../../db/types';
import { activeGoals } from '../plan/goals';
import { buildMicrocycle, type Microcycle } from '../plan/microcycle';
import { isDoableWith } from '../train/exercises';
import { loadHistory, type LoadEvent } from '../train/load';
import { currentStreak, dayIndex } from '../train/log';

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
}

const FOCUS_DETAIL: Record<TriadArea, string> = {
  mental:
    'Your weakest area is the mental game. Climb for practice and work mental skills — visualization, breathing, and focus.',
  technical:
    'Your weakest area is technique. Prioritise deliberate skill practice — footwork and movement — on climbs within your limit.',
  physical:
    'Your weakest area is physical. After a full warm-up, train in hierarchy order: skill → max strength/power → endurance → conditioning.',
};

const WARM_UP =
  'Warm up thoroughly: pulse-raiser, joint mobility, then easy climbing until your forearms feel ready.';
const COOL_DOWN = 'Cool down: gently stretch the forearms, shoulders, and hips.';

/** Deterministically pick `count` items from a list, rotating by the day. */
function rotate<T>(items: T[], dayIdx: number, count: number): T[] {
  if (items.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i++) {
    out.push(items[(dayIdx + i) % items.length]);
  }
  return out;
}

/**
 * A library exercise for a session focus, rotated by the day and restricted to
 * what the climber can reach. Returns null when nothing in the library fits.
 */
function pickExercise(
  focus: SessionFocusId,
  dayIdx: number,
  equipment: EquipmentId[],
): Exercise | null {
  const area = sessionFocus(focus).hierarchyAreaId;
  const pool = EXERCISES.filter((e) => e.hierarchyAreaId === area && isDoableWith(e, equipment));
  return pool.length ? pool[dayIdx % pool.length] : null;
}

/** Turn one session focus into a concrete instruction, or null if impossible. */
function focusStep(focus: SessionFocusId, dayIdx: number, equipment: EquipmentId[]): string | null {
  const spec = sessionFocus(focus);
  if (focus === 'mental' || focus === 'skill') {
    const area = focus === 'mental' ? 'mental' : 'technical';
    const drill = rotate(PRESCRIPTIONS_BY_AREA[area], dayIdx, 1)[0];
    return drill ? `${spec.label} — ${drill.title}: ${drill.detail}` : null;
  }
  const exercise = pickExercise(focus, dayIdx, equipment);
  return exercise ? `${spec.label} — ${exercise.name}: ${exercise.description}` : null;
}

/** Build the ordered steps for a training day from the scheduler's choices. */
function schedulerPlan(cycle: Microcycle, dayIdx: number, equipment: EquipmentId[]): string[] {
  const steps = [WARM_UP];
  for (const focus of [cycle.primary, ...cycle.supporting]) {
    if (!focus) continue;
    const step = focusStep(focus, dayIdx, equipment);
    if (step) steps.push(step);
  }
  steps.push(COOL_DOWN);
  return steps;
}

/**
 * The pre-scheduler plan, kept for callers that don't pass load history: an
 * ordered session weighted to the weakest triad area.
 */
function legacyPlan(area: TriadArea, dayIdx: number, equipment: EquipmentId[]): string[] {
  if (area === 'physical') {
    const steps = [
      WARM_UP,
      'Skill (while fresh): climb a few problems or routes a grade or two below your limit, focusing on smooth, precise movement.',
    ];
    for (const focus of ['maxStrength', 'powerEndurance', 'conditioning'] as SessionFocusId[]) {
      const step = focusStep(focus, dayIdx, equipment);
      if (step) steps.push(step);
    }
    steps.push(COOL_DOWN);
    return steps;
  }
  const drills = rotate(PRESCRIPTIONS_BY_AREA[area], dayIdx, 3);
  const closing =
    area === 'mental'
      ? 'Then climb at your limit, applying the mental skills under real pressure.'
      : 'Then take the drills onto harder climbs, keeping the same movement quality.';
  return [WARM_UP, ...drills.map((d) => `${d.title}: ${d.detail}`), closing];
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
  const dayIdx = dayIndex(input.nowMs);
  const equipment = input.equipment ?? DEFAULT_EQUIPMENT;

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
  };

  const needsRest = cycle ? cycle.restDay : streak >= 3;
  if (needsRest) {
    return {
      ...common,
      kind: 'rest',
      headline: 'Take a rest day',
      detail:
        cycle?.restReason ??
        `You've trained ${streak} days in a row. Training 3–4 days straight risks overtraining — rest is when your body actually gets stronger.`,
      focusArea: null,
      plan: [
        'Rest from hard climbing and training today.',
        'Stay loose: light mobility, gentle stretching, and a short walk are fine.',
        'Prioritise sleep, food, and hydration — recovery is when the gains happen.',
      ],
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
      plan: [
        'Open Assess and complete the 30-question self-assessment.',
        'Note your weakest triad area — it becomes the focus of your daily plan.',
      ],
    };
  }

  if (cycle && cycle.primary) {
    const spec = sessionFocus(cycle.primary);
    return {
      ...common,
      kind: 'train',
      headline: `Today: ${spec.label}`,
      detail: spec.description,
      focusArea: spec.triadArea,
      plan: schedulerPlan(cycle, dayIdx, equipment),
      focusItems: input.weakSpots ?? [],
      focus: cycle.primary,
      supportingFocuses: cycle.supporting,
    };
  }

  return {
    ...common,
    kind: 'train',
    headline: `Focus on ${TRIAD_LABELS[input.weakestArea]}`,
    detail: FOCUS_DETAIL[input.weakestArea],
    focusArea: input.weakestArea,
    plan: legacyPlan(input.weakestArea, dayIdx, equipment),
    focusItems: input.weakSpots ?? [],
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
  return buildDailyRecommendation({ ...rest, history: loadHistory(journals, climbs) });
}
