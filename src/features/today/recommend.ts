/**
 * "What should I work on today?" — a faithful synthesis of the book's guidance,
 * not invented coaching. Pure and unit-testable.
 *
 * This is the **deterministic baseline**: it always runs, offline, and is the
 * fallback whenever the AI coach is unavailable. It now emits a concrete ordered
 * plan (warm-up → drills weighted to the weakest area → cool-down), not just a
 * sentence.
 *
 * Rules, each grounded in Hörst:
 *  - If you've trained 3+ days in a row → rest (Self-Assessment Q9 / Ch 8 rest).
 *  - Otherwise target your weakest triad area (Ch 2: "the most effective training
 *    program targets this area for improvement").
 *  - If no assessment exists yet → take it first (it drives everything).
 *  - Within a session, train in hierarchy order: skill → max strength/power →
 *    anaerobic endurance → conditioning (Ch 8).
 *  - Keep active short/medium-term goals in view (Ch 2 goal-setting).
 */
import { EXERCISES } from '../../content/exercises';
import { PRESCRIPTIONS_BY_AREA } from '../../content/prescriptions';
import { TRIAD_LABELS, type Exercise, type TriadArea } from '../../content/types';
import type { HierarchyAreaId } from '../../content/planning';
import type { GoalRecord } from '../../db/types';
import { activeGoals } from '../plan/goals';
import { currentStreak, dayIndex, restRecommended } from '../train/log';

export interface DailyInput {
  /** Weakest triad area from the latest assessment, or null if none taken. */
  weakestArea: TriadArea | null;
  /** Specific low-rated statements in the weakest area, worst-first (optional). */
  weakSpots?: string[];
  goals: GoalRecord[];
  /** Epoch-ms dates that count as training (journals + climbs). */
  trainingDates: number[];
  nowMs: number;
}

export type DailyKind = 'rest' | 'assess' | 'train';

export interface DailyRecommendation {
  kind: DailyKind;
  streak: number;
  headline: string;
  detail: string;
  focusArea: TriadArea | null;
  /** Concrete, ordered steps for today (warm-up → drills → cool-down). */
  plan: string[];
  /** Specific weak-spot statements to target today (from the assessment). */
  focusItems: string[];
  /** Titles of active short/medium-term goals to keep in mind. */
  goalReminders: string[];
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

/** A concrete library exercise for a hierarchy area, rotated by the day. */
function pickExercise(area: HierarchyAreaId, dayIdx: number): Exercise | null {
  const pool = EXERCISES.filter((e) => e.hierarchyAreaId === area);
  return pool.length ? pool[dayIdx % pool.length] : null;
}

function physicalPlan(dayIdx: number): string[] {
  const steps = [
    WARM_UP,
    'Skill (while fresh): climb a few problems or routes a grade or two below your limit, focusing on smooth, precise movement.',
  ];
  const power = pickExercise('maxStrengthPower', dayIdx);
  if (power) steps.push(`Max strength & power: ${power.name} — ${power.description}`);
  const endurance = pickExercise('anaerobicEndurance', dayIdx);
  if (endurance) steps.push(`Anaerobic endurance: ${endurance.name} — ${endurance.description}`);
  const conditioning = pickExercise('conditioning', dayIdx);
  if (conditioning) steps.push(`Conditioning: ${conditioning.name} — ${conditioning.description}`);
  steps.push(COOL_DOWN);
  return steps;
}

function skillOrMentalPlan(area: 'mental' | 'technical', dayIdx: number): string[] {
  const drills = rotate(PRESCRIPTIONS_BY_AREA[area], dayIdx, 3);
  const closing =
    area === 'mental'
      ? 'Then climb at your limit, applying the mental skills under real pressure.'
      : 'Then take the drills onto harder climbs, keeping the same movement quality.';
  return [WARM_UP, ...drills.map((d) => `${d.title}: ${d.detail}`), closing];
}

function trainPlan(area: TriadArea, dayIdx: number): string[] {
  return area === 'physical' ? physicalPlan(dayIdx) : skillOrMentalPlan(area, dayIdx);
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

  if (restRecommended(streak)) {
    return {
      kind: 'rest',
      streak,
      headline: 'Take a rest day',
      detail: `You've trained ${streak} days in a row. Training 3–4 days straight risks overtraining — rest is when your body actually gets stronger.`,
      focusArea: null,
      plan: [
        'Rest from hard climbing and training today.',
        'Stay loose: light mobility, gentle stretching, and a short walk are fine.',
        'Prioritise sleep, food, and hydration — recovery is when the gains happen.',
      ],
      focusItems: [],
      goalReminders: reminders,
    };
  }

  if (input.weakestArea === null) {
    return {
      kind: 'assess',
      streak,
      headline: 'Start with a self-assessment',
      detail:
        'Take the 30-question self-assessment so the app can target your weakest area of the performance triad.',
      focusArea: null,
      plan: [
        'Open Assess and complete the 30-question self-assessment.',
        'Note your weakest triad area — it becomes the focus of your daily plan.',
      ],
      focusItems: [],
      goalReminders: reminders,
    };
  }

  return {
    kind: 'train',
    streak,
    headline: `Focus on ${TRIAD_LABELS[input.weakestArea]}`,
    detail: FOCUS_DETAIL[input.weakestArea],
    focusArea: input.weakestArea,
    plan: trainPlan(input.weakestArea, dayIdx),
    focusItems: input.weakSpots ?? [],
    goalReminders: reminders,
  };
}
