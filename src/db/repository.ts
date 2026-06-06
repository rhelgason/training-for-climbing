import type {
  AssessmentRecord,
  BenchmarkRecord,
  CheckinRecord,
  GoalPatch,
  GoalRecord,
  NewAssessment,
  NewBenchmark,
  NewCheckin,
  NewGoal,
  NewSession,
  SessionRecord,
  UsageEventRecord,
} from './types';

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

  // --- Goals ---
  saveGoal(input: NewGoal): Promise<GoalRecord>;
  /** Newest first. */
  listGoals(): Promise<GoalRecord[]>;
  getGoal(id: string): Promise<GoalRecord | null>;
  /** Returns the updated record, or null if the id does not exist. */
  updateGoal(id: string, patch: GoalPatch): Promise<GoalRecord | null>;
  deleteGoal(id: string): Promise<void>;

  // --- Training sessions ---
  saveSession(input: NewSession): Promise<SessionRecord>;
  /** Newest first (by session date). */
  listSessions(): Promise<SessionRecord[]>;
  getSession(id: string): Promise<SessionRecord | null>;
  deleteSession(id: string): Promise<void>;

  // --- Fitness Evaluation benchmarks ---
  saveBenchmark(input: NewBenchmark): Promise<BenchmarkRecord>;
  /** Newest first (by test date). */
  listBenchmarks(): Promise<BenchmarkRecord[]>;
  deleteBenchmark(id: string): Promise<void>;

  // --- Energy-Emotion check-ins ---
  saveCheckin(input: NewCheckin): Promise<CheckinRecord>;
  /** Newest first (by reading time). */
  listCheckins(): Promise<CheckinRecord[]>;
  deleteCheckin(id: string): Promise<void>;

  // --- Usage events (analytics) ---
  recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void>;
  /** Newest first; optionally limited. */
  listEvents(limit?: number): Promise<UsageEventRecord[]>;
}
