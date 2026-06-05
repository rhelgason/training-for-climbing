import type { Responses } from '../features/assess/scoring';
import type { TriadArea } from '../content/types';

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

/** A persisted usage event (analytics, local-first). */
export interface UsageEventRecord {
  id: string;
  name: string;
  props: Record<string, unknown>;
  timestamp: number;
}
