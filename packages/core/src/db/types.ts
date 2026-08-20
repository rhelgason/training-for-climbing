import type { Responses } from '../features/assess/scoring';
import type { TriadArea } from '../content/types';
import type { AbilityTier, GoalHorizon, GoalStatus } from '../content/planning';
import type { ClimbDiscipline, ClimbEnvironment, ClimbOutcome } from '../content/climbing';
import type { ActivityTag, JournalIntensity } from '../content/journal';
import type {
  EquipmentId,
  Readiness,
  SessionFocusId,
  SessionLength,
  StyleFocus,
} from '../content/trainingContext';

/** The grade scale a climber uses (only US YDS/V for now). */
export type GradeSystem = 'yds-v';

/** Single-row user profile / settings. */
export interface ProfileRecord {
  /** Always PROFILE_ID — this is a singleton. */
  id: string;
  createdAt: number;
  updatedAt: number;
  abilityTier: AbilityTier;
  defaultDiscipline: ClimbDiscipline;
  gradeSystem: GradeSystem;
  /** Weeks between self-assessment reminders (Cycle of Improvement). */
  reassessWeeks: number;
  /** Opt-in to the AI coach (requires a server LLM key). */
  aiCoachEnabled: boolean;

  // --- Training context, captured at sign-up and editable later. ---

  /**
   * Free-text "here's me as a climber" — years in, injuries, what they're
   * working on, quirks of their gym. Read by the AI coach verbatim; the
   * deterministic engine ignores it.
   */
  climberContext?: string;
  /** What they're optimising for; biases which focus wins an otherwise free day. */
  styleFocus: StyleFocus;
  /** Equipment normally available (their usual gym / home setup). */
  equipment: EquipmentId[];
  /** How many days a week they can realistically train. */
  daysPerWeek: number;
  /** Their typical session length. */
  sessionLength: SessionLength;
  /** Set when the guided sign-up flow was completed; drives the welcome redirect. */
  onboardedAt?: number;
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRecord,
    | 'abilityTier'
    | 'defaultDiscipline'
    | 'gradeSystem'
    | 'reassessWeeks'
    | 'aiCoachEnabled'
    | 'climberContext'
    | 'styleFocus'
    | 'equipment'
    | 'daysPerWeek'
    | 'sessionLength'
    | 'onboardedAt'
  >
>;

/**
 * What the climber has to work with *today* — the one-tap check-in above the
 * daily plan. Separate from the journal on purpose: this is prospective ("what
 * I can do"), the journal is retrospective ("what I did"). One row per day.
 */
export interface DailyContextRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** The day this context is for (epoch ms). */
  date: number;
  environment: ClimbEnvironment;
  /** Equipment reachable today — overrides the profile's usual set. */
  equipment: EquipmentId[];
  sessionLength: SessionLength;
  readiness: Readiness;
  /** Optional free text, e.g. "at a friend's gym, no campus board". */
  note?: string;
}

export type NewDailyContext = Omit<DailyContextRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: number;
  updatedAt?: number;
};

export type DailyContextPatch = Partial<
  Pick<
    DailyContextRecord,
    'date' | 'environment' | 'equipment' | 'sessionLength' | 'readiness' | 'note'
  >
>;

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
  /** Bumped on every edit; used for last-write-wins cloud sync. */
  updatedAt: number;
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

export type NewGoal = Omit<
  GoalRecord,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'
> & {
  status?: GoalStatus;
  createdAt?: number;
  updatedAt?: number;
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

/** A daily journal entry — a quick "what I did / how it went" log. */
export interface JournalEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** The day this entry is for (epoch ms). */
  date: number;
  /** Free-text: what I did today. */
  summary?: string;
  /** Free-text: what went well. */
  wins?: string;
  /** Free-text: what didn't go well. */
  struggles?: string;
  /** Activity tags (climbing, fingerboard, strength, …, rest). */
  activities: ActivityTag[];
  intensity?: JournalIntensity;
  /**
   * What kind of training load the day actually applied. Recorded exactly when
   * the day's prescribed plan is marked done, and inferred from the tags above
   * otherwise. This is what lets the scheduler honour "48 hours between max-
   * strength sessions" instead of guessing from a free-text blurb.
   */
  focus?: SessionFocusId[];
  /**
   * Prescribed steps the climber didn't get to. Recorded by unticking them when
   * logging the day, so "ran out of time before the conditioning block" is a
   * fact the coach can act on rather than something lost between sessions.
   */
  skipped?: string[];
}

export type NewJournal = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: number;
  updatedAt?: number;
};

export type JournalPatch = Partial<
  Pick<
    JournalEntry,
    'date' | 'summary' | 'wins' | 'struggles' | 'activities' | 'intensity' | 'focus' | 'skipped'
  >
>;

/** A logged ascent — what you climbed on a given day. */
export interface ClimbRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** The day of the climb (epoch ms). */
  date: number;
  environment: ClimbEnvironment;
  discipline: ClimbDiscipline;
  /** Grade string within the discipline's scale (e.g. "5.11a" or "V5"). */
  grade: string;
  outcome: ClimbOutcome;
  name?: string;
  location?: string;
  notes?: string;
}

export type NewClimb = Omit<ClimbRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: number;
  updatedAt?: number;
};

export type ClimbPatch = Partial<
  Pick<
    ClimbRecord,
    'date' | 'environment' | 'discipline' | 'grade' | 'outcome' | 'name' | 'location' | 'notes'
  >
>;

/** A period in the annual training macrocycle (Appendix B planner). */
export interface MacrocyclePeriodRecord {
  id: string;
  createdAt: number;
  /** Bumped on every edit; used for last-write-wins cloud sync. */
  updatedAt: number;
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

export type NewMacrocyclePeriod = Omit<MacrocyclePeriodRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: number;
  updatedAt?: number;
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

/** Syncable tables, used as tombstone keys. */
export type SyncTable =
  | 'assessments'
  | 'goals'
  | 'journals'
  | 'climbs'
  | 'periods'
  | 'benchmarks'
  | 'checkins'
  | 'dailyContexts';

/** Records that a record was deleted, so deletions propagate during sync. */
export interface TombstoneRecord {
  table: SyncTable;
  id: string;
  deletedAt: number;
}

/**
 * A full export of the user's data for cloud sync. Excludes analytics events
 * (local-only). Every table is keyed by `id` and carries a comparable
 * timestamp (`updatedAt` where present, else `createdAt`) for last-write-wins;
 * `tombstones` carry deletions.
 */
export interface Snapshot {
  assessments: AssessmentRecord[];
  goals: GoalRecord[];
  journals: JournalEntry[];
  climbs: ClimbRecord[];
  periods: MacrocyclePeriodRecord[];
  benchmarks: BenchmarkRecord[];
  checkins: CheckinRecord[];
  dailyContexts: DailyContextRecord[];
  /** Singleton profile (last-write-wins by updatedAt), or null if never set. */
  profile: ProfileRecord | null;
  tombstones: TombstoneRecord[];
}

/** A persisted usage event (analytics, local-first). */
export interface UsageEventRecord {
  id: string;
  name: string;
  props: Record<string, unknown>;
  timestamp: number;
}
