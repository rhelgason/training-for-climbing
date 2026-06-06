import type { Responses } from '../features/assess/scoring';
import type { TriadArea } from '../content/types';
import type { GoalHorizon, GoalStatus, HierarchyAreaId } from '../content/planning';

/** A persisted Self-Assessment attempt. */
export interface AssessmentRecord {
  id: string;
  /** Epoch milliseconds when the attempt was saved. */
  createdAt: number;
  responses: Responses;
  mental: number;
  technical: number;
  physical: number;
  weakestArea: TriadArea;
}

export type NewAssessment = Omit<AssessmentRecord, 'id' | 'createdAt'> & {
  /** Optional override for createdAt (tests); defaults to now. */
  createdAt?: number;
};

/** A persisted training goal (Chapter 2 goal-setting). */
export interface GoalRecord {
  id: string;
  createdAt: number;
  horizon: GoalHorizon;
  /** The precise goal statement. */
  title: string;
  /** Mission statement summarising the goal's purpose. */
  mission?: string;
  /** What the climber will give up to reach it (a distinctive Hörst step). */
  sacrifice?: string;
  /** Optional deadline (epoch ms). */
  targetDate?: number;
  /** Optional link to a performance-triad area (e.g. a flagged weakness). */
  triadArea?: TriadArea;
  status: GoalStatus;
  /** Epoch ms when marked done. */
  completedAt?: number;
}

export type NewGoal = Omit<GoalRecord, 'id' | 'createdAt' | 'status' | 'completedAt'> & {
  status?: GoalStatus;
  createdAt?: number;
};

export type GoalPatch = Partial<
  Pick<
    GoalRecord,
    | 'horizon'
    | 'title'
    | 'mission'
    | 'sacrifice'
    | 'targetDate'
    | 'triadArea'
    | 'status'
    | 'completedAt'
  >
>;

/** A logged training session / climbing day (the book's "training notebook"). */
export interface SessionRecord {
  id: string;
  createdAt: number;
  /** The day the session happened (epoch ms). */
  date: number;
  /** Which areas of the 5-step training hierarchy were trained. */
  focusAreas: HierarchyAreaId[];
  notes?: string;
}

export type NewSession = Omit<SessionRecord, 'id' | 'createdAt'> & { createdAt?: number };

/** A period in the annual training macrocycle (Appendix B planner). */
export interface MacrocyclePeriodRecord {
  id: string;
  createdAt: number;
  /** e.g. "Winter base", "Spring power". */
  label: string;
  startDate: number;
  endDate: number;
  /** The training emphasis for this block (free text, e.g. "Max strength & power"). */
  focus?: string;
  /** The climbing objective / seasonal goal for this block. */
  objective?: string;
  notes?: string;
}

export type NewMacrocyclePeriod = Omit<MacrocyclePeriodRecord, 'id' | 'createdAt'> & {
  createdAt?: number;
};

export type MacrocyclePeriodPatch = Partial<
  Pick<MacrocyclePeriodRecord, 'label' | 'startDate' | 'endDate' | 'focus' | 'objective' | 'notes'>
>;

/** A recorded Fitness Evaluation benchmark result (Appendix D). */
export interface BenchmarkRecord {
  id: string;
  createdAt: number;
  /** Which test (matches FitnessTest.id in content/fitnessEvaluation). */
  testId: string;
  /** For bilateral tests (e.g. one-arm lock-off); omitted otherwise. */
  side?: 'left' | 'right';
  /** The recorded result in the test's unit. */
  value: number;
  /** The day the test was performed (epoch ms). */
  date: number;
}

export type NewBenchmark = Omit<BenchmarkRecord, 'id' | 'createdAt'> & { createdAt?: number };

/**
 * An Energy-Emotion reading (Appendix B chart). Energy on a 0–10 axis,
 * emotion on a −5..+5 axis; logged through the day to spot patterns.
 */
export interface CheckinRecord {
  id: string;
  createdAt: number;
  /** When the reading was taken (epoch ms). */
  time: number;
  /** Physical energy, 0 (depleted) … 10 (peak). */
  energy: number;
  /** Emotional mind-set, −5 (very negative) … +5 (very positive). */
  emotion: number;
  note?: string;
}

export type NewCheckin = Omit<CheckinRecord, 'id' | 'createdAt'> & { createdAt?: number };

/** A persisted usage event (analytics, local-first). */
export interface UsageEventRecord {
  id: string;
  name: string;
  props: Record<string, unknown>;
  timestamp: number;
}
