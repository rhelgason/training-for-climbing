import type {
  AssessmentRecord,
  BenchmarkRecord,
  CheckinRecord,
  ClimbRecord,
  DailyContextPatch,
  DailyContextRecord,
  GoalPatch,
  GoalRecord,
  MacrocyclePeriodPatch,
  MacrocyclePeriodRecord,
  JournalEntry,
  JournalPatch,
  NewAssessment,
  NewBenchmark,
  ClimbPatch,
  NewCheckin,
  NewClimb,
  NewDailyContext,
  NewGoal,
  NewJournal,
  NewMacrocyclePeriod,
  ProfilePatch,
  ProfileRecord,
  Snapshot,
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

  // --- Daily journal ---
  saveJournal(input: NewJournal): Promise<JournalEntry>;
  /** Newest first (by entry date). */
  listJournals(): Promise<JournalEntry[]>;
  getJournal(id: string): Promise<JournalEntry | null>;
  updateJournal(id: string, patch: JournalPatch): Promise<JournalEntry | null>;
  deleteJournal(id: string): Promise<void>;

  // --- Climbs (logged ascents) ---
  saveClimb(input: NewClimb): Promise<ClimbRecord>;
  /** Newest first (by climb date). */
  listClimbs(): Promise<ClimbRecord[]>;
  getClimb(id: string): Promise<ClimbRecord | null>;
  updateClimb(id: string, patch: ClimbPatch): Promise<ClimbRecord | null>;
  deleteClimb(id: string): Promise<void>;

  // --- Macrocycle periods ---
  saveMacrocyclePeriod(input: NewMacrocyclePeriod): Promise<MacrocyclePeriodRecord>;
  /** Ordered by start date ascending. */
  listMacrocyclePeriods(): Promise<MacrocyclePeriodRecord[]>;
  getMacrocyclePeriod(id: string): Promise<MacrocyclePeriodRecord | null>;
  updateMacrocyclePeriod(
    id: string,
    patch: MacrocyclePeriodPatch,
  ): Promise<MacrocyclePeriodRecord | null>;
  deleteMacrocyclePeriod(id: string): Promise<void>;

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

  // --- Daily training context (one row per day) ---
  /**
   * Upsert today's context by calendar day — calling this twice on the same day
   * edits one row rather than creating two.
   */
  saveDailyContext(input: NewDailyContext): Promise<DailyContextRecord>;
  /** Newest first (by context date). */
  listDailyContexts(): Promise<DailyContextRecord[]>;
  /** The context for the calendar day containing `dateMs`, if one was recorded. */
  getDailyContext(dateMs: number): Promise<DailyContextRecord | null>;
  updateDailyContext(id: string, patch: DailyContextPatch): Promise<DailyContextRecord | null>;
  deleteDailyContext(id: string): Promise<void>;

  // --- Profile (singleton settings) ---
  getProfile(): Promise<ProfileRecord | null>;
  /** Upsert the singleton profile; returns the full updated record. */
  saveProfile(patch: ProfilePatch): Promise<ProfileRecord>;

  // --- Cloud sync ---
  /** Full export of all syncable data (excludes analytics events). */
  exportSnapshot(): Promise<Snapshot>;
  /** Upsert every record in the snapshot by id (used after a sync merge). */
  applySnapshot(snapshot: Snapshot): Promise<void>;

  // --- Usage events (analytics) ---
  recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void>;
  /** Newest first; optionally limited. */
  listEvents(limit?: number): Promise<UsageEventRecord[]>;
}
