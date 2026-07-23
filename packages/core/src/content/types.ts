/**
 * Shared content types for material derived from
 * Eric J. Hörst, *Training for Climbing* (3rd ed.).
 *
 * NOTE: This app is a personal-use companion to the book. Content here
 * paraphrases the book's structured tools (assessment, tips, tests). It is not
 * a substitute for owning/reading the book.
 */

import type { HierarchyAreaId } from './planning';

/** The "performance triad" — the book's three pillars of climbing performance. */
export type TriadArea = 'mental' | 'technical' | 'physical';

export const TRIAD_AREAS: TriadArea[] = ['mental', 'technical', 'physical'];

export const TRIAD_LABELS: Record<TriadArea, string> = {
  mental: 'Mental',
  technical: 'Technical',
  physical: 'Physical',
};

/** A single Self-Assessment question (Chapter 2). */
export interface AssessmentQuestion {
  /** Stable 1-based number matching the book's test ordering. */
  id: number;
  /** The statement the climber rates. */
  prompt: string;
  /** Which triad column this question contributes to (book Table 2.1). */
  triad: TriadArea;
}

/**
 * A single physical self-test. The 3rd edition splits these across the finger
 * self-tests (Chapter 8) and the pull-muscle self-tests (Chapter 9).
 */
export interface FitnessTest {
  id: string;
  name: string;
  /** How to perform the test. */
  instructions: string;
  /** What is recorded (the evaluation metric). */
  metric: string;
  /** Unit of the recorded value, used for input + charts. */
  unit: 'reps' | 'seconds' | 'ratio' | 'inches' | 'lb';
  /** Some tests record left and right separately (e.g. a one-arm test). */
  bilateral?: boolean;
}

/** A glossary term (book Glossary). */
export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** Display grouping for exercises (book Chapters 6–9). */
export type ExerciseCategory =
  | 'mobility'
  | 'flexibility'
  | 'stability'
  | 'finger-forearm'
  | 'pull'
  | 'power'
  | 'endurance'
  | 'aerobic'
  | 'core'
  | 'legs'
  | 'antagonist';

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  mobility: 'Mobility & self-massage',
  flexibility: 'Flexibility',
  stability: 'Stability',
  'finger-forearm': 'Finger & forearm',
  pull: 'Pull muscles',
  power: 'Power',
  endurance: 'Endurance',
  aerobic: 'Aerobic',
  core: 'Core',
  legs: 'Legs & posterior chain',
  antagonist: 'Antagonist',
};

/** A training exercise from the book's conditioning chapters. */
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  /**
   * Which performance-triad area this exercise develops. The library is drawn
   * from the conditioning chapters, so every entry is `physical`; the field
   * exists so the daily baseline and library can filter "for my weakness".
   */
  triadArea: TriadArea;
  /** Where this exercise sits in the within-session training hierarchy. */
  hierarchyAreaId: HierarchyAreaId;
}
