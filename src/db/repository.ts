import type { AssessmentRecord, NewAssessment, UsageEventRecord } from './types';

/**
 * Persistence boundary for the whole app. Feature code depends on this
 * interface only — never on SQLite/Drizzle directly — so a cloud-sync backend
 * can be swapped in later without touching features.
 */
export interface Repository {
  /** Create tables / run migrations. Safe to call more than once. */
  init(): Promise<void>;

  // --- Self-Assessment ---
  saveAssessment(input: NewAssessment): Promise<AssessmentRecord>;
  /** Newest first. */
  listAssessments(): Promise<AssessmentRecord[]>;
  getAssessment(id: string): Promise<AssessmentRecord | null>;

  // --- Usage events (analytics) ---
  recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void>;
  /** Newest first; optionally limited. */
  listEvents(limit?: number): Promise<UsageEventRecord[]>;
}
