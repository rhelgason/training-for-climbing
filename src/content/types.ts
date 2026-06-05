/**
 * Shared content types for material derived from
 * Eric J. Hörst, *Training for Climbing* (3rd ed.).
 *
 * NOTE: This app is a personal-use companion to the book. Content here
 * paraphrases the book's structured tools (assessment, tips, tests). It is not
 * a substitute for owning/reading the book.
 */

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
  /** Which triad column this question contributes to (book Figure 2.1). */
  triad: TriadArea;
}

/** A single physical benchmark in the Fitness Evaluation (Appendix D). */
export interface FitnessTest {
  id: string;
  name: string;
  /** How to perform the test. */
  instructions: string;
  /** What is recorded (the evaluation metric). */
  metric: string;
  /** Unit of the recorded value, used for input + charts. */
  unit: 'reps' | 'seconds' | 'ratio' | 'inches' | 'cycles';
  /** Some tests record left and right separately (e.g. one-arm lock-off). */
  bilateral?: boolean;
}

/** A glossary term (book Glossary). */
export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** Display grouping for exercises (book Chapters 6–7). */
export type ExerciseCategory =
  | 'finger-forearm'
  | 'pull'
  | 'power'
  | 'endurance'
  | 'core'
  | 'antagonist'
  | 'flexibility';

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  'finger-forearm': 'Finger & forearm',
  pull: 'Pull muscles',
  power: 'Power',
  endurance: 'Endurance',
  core: 'Core',
  antagonist: 'Antagonist',
  flexibility: 'Flexibility',
};

/** A training exercise from the book's conditioning chapters. */
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
}
