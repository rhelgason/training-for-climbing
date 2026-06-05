import type { Responses } from '../features/assess/scoring';
import type { TriadArea } from '../content/types';
import type { GoalHorizon, GoalStatus } from '../content/planning';

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

/** A persisted usage event (analytics, local-first). */
export interface UsageEventRecord {
  id: string;
  name: string;
  props: Record<string, unknown>;
  timestamp: number;
}
