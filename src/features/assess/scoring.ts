/**
 * Pure scoring logic for the Self-Assessment Test.
 * No I/O, no React — fully unit-testable.
 */
import {
  SELF_ASSESSMENT_QUESTIONS,
  WEAKNESS_THRESHOLD,
  MIN_RATING,
  MAX_RATING,
} from '../../content/selfAssessment';
import type { AssessmentQuestion, TriadArea } from '../../content/types';
import { TRIAD_AREAS, TRIAD_LABELS } from '../../content/types';

/** Map of question id -> rating (0..5). */
export type Responses = Record<number, number>;

export interface TriadScores {
  mental: number;
  technical: number;
  physical: number;
}

export interface FlaggedWeakness {
  question: AssessmentQuestion;
  rating: number;
}

export interface AssessmentResult {
  scores: TriadScores;
  /** Max possible points per area, given how many questions it contains. */
  maxPerArea: TriadScores;
  weakestArea: TriadArea;
  /** True when all three areas are within `BALANCED_WITHIN` points of each other. */
  balanced: boolean;
  flagged: FlaggedWeakness[];
}

/** The book calls a climber "balanced" when all three areas are within 5 points. */
export const BALANCED_WITHIN = 5;

/** Number of questions per triad area (for max-score scaling). */
export function questionCountByArea(): TriadScores {
  return SELF_ASSESSMENT_QUESTIONS.reduce(
    (acc, q) => {
      acc[q.triad] += 1;
      return acc;
    },
    { mental: 0, technical: 0, physical: 0 },
  );
}

function clampRating(rating: number): number {
  if (Number.isNaN(rating)) return MIN_RATING;
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(rating)));
}

/** True only when every question has a rating in [0,5]. */
export function isComplete(responses: Responses): boolean {
  return SELF_ASSESSMENT_QUESTIONS.every((q) => {
    const r = responses[q.id];
    return typeof r === 'number' && r >= MIN_RATING && r <= MAX_RATING;
  });
}

export function unansweredQuestionIds(responses: Responses): number[] {
  return SELF_ASSESSMENT_QUESTIONS.filter((q) => typeof responses[q.id] !== 'number').map(
    (q) => q.id,
  );
}

/** Sum ratings per triad area. Missing answers count as 0. */
export function computeTriadScores(responses: Responses): TriadScores {
  return SELF_ASSESSMENT_QUESTIONS.reduce(
    (acc, q) => {
      const r = responses[q.id];
      if (typeof r === 'number') acc[q.triad] += clampRating(r);
      return acc;
    },
    { mental: 0, technical: 0, physical: 0 },
  );
}

export function maxScoresByArea(): TriadScores {
  const counts = questionCountByArea();
  return {
    mental: counts.mental * MAX_RATING,
    technical: counts.technical * MAX_RATING,
    physical: counts.physical * MAX_RATING,
  };
}

/**
 * The lowest-scoring area is the weakest. Ties are broken by the canonical
 * triad order (mental, technical, physical) for determinism.
 */
export function determineWeakestArea(scores: TriadScores): TriadArea {
  let weakest: TriadArea = TRIAD_AREAS[0];
  for (const area of TRIAD_AREAS) {
    if (scores[area] < scores[weakest]) weakest = area;
  }
  return weakest;
}

export function isBalanced(scores: TriadScores): boolean {
  const values = TRIAD_AREAS.map((a) => scores[a]);
  return Math.max(...values) - Math.min(...values) <= BALANCED_WITHIN;
}

/**
 * Questions scored at or below the weakness threshold, sorted worst-first
 * (lowest rating, then question id) so the UI can surface priorities.
 */
export function getFlaggedWeaknesses(responses: Responses): FlaggedWeakness[] {
  return SELF_ASSESSMENT_QUESTIONS.filter((q) => {
    const r = responses[q.id];
    return typeof r === 'number' && r <= WEAKNESS_THRESHOLD;
  })
    .map((question) => ({ question, rating: responses[question.id] }))
    .sort((a, b) => a.rating - b.rating || a.question.id - b.question.id);
}

/**
 * The prompts of the flagged (low-rated) statements within a single triad area,
 * worst-first, capped at `limit`. Feeds the daily plan + AI coach so "what to
 * work on" can name concrete weak spots, not just the area.
 */
export function flaggedPromptsForArea(responses: Responses, area: TriadArea, limit = 3): string[] {
  return getFlaggedWeaknesses(responses)
    .filter((f) => f.question.triad === area)
    .slice(0, limit)
    .map((f) => f.question.prompt);
}

export interface FlaggedGroup {
  area: TriadArea;
  items: FlaggedWeakness[];
}

/**
 * Flagged weaknesses grouped by triad area, in canonical triad order, with
 * empty areas omitted. The book says to "sort and group them according to the
 * aspects of the performance triad."
 */
export function groupFlaggedByArea(flagged: FlaggedWeakness[]): FlaggedGroup[] {
  return TRIAD_AREAS.map((area) => ({
    area,
    items: flagged.filter((f) => f.question.triad === area),
  })).filter((group) => group.items.length > 0);
}

/** Full result bundle for a completed (or partial) set of responses. */
export function evaluate(responses: Responses): AssessmentResult {
  const scores = computeTriadScores(responses);
  return {
    scores,
    maxPerArea: maxScoresByArea(),
    weakestArea: determineWeakestArea(scores),
    balanced: isBalanced(scores),
    flagged: getFlaggedWeaknesses(responses),
  };
}

export function triadLabel(area: TriadArea): string {
  return TRIAD_LABELS[area];
}
