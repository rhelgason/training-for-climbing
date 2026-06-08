import * as SQLite from 'expo-sqlite';

import { log } from '../lib/logger';
import { newId } from '../lib/ids';
import type { TriadArea } from '../content/types';
import type { AbilityTier, GoalHorizon, GoalStatus } from '../content/planning';
import type { Responses } from '../features/assess/scoring';
import type { Repository } from './repository';
import type {
  AssessmentRecord,
  BenchmarkRecord,
  CheckinRecord,
  ClimbPatch,
  ClimbRecord,
  GoalPatch,
  GoalRecord,
  MacrocyclePeriodPatch,
  MacrocyclePeriodRecord,
  JournalEntry,
  JournalPatch,
  NewAssessment,
  NewBenchmark,
  NewCheckin,
  NewClimb,
  NewGoal,
  NewJournal,
  NewMacrocyclePeriod,
  ProfilePatch,
  ProfileRecord,
  GradeSystem,
  Snapshot,
  SyncTable,
  TombstoneRecord,
  UsageEventRecord,
} from './types';
import type { ClimbDiscipline, ClimbEnvironment, ClimbOutcome } from '../content/climbing';
import type { ActivityTag, JournalIntensity } from '../content/journal';
import { PROFILE_DEFAULTS, PROFILE_ID } from '../content/profile';

const DB_NAME = 'training-for-climbing.db';

/** Map a logical sync table to its physical SQLite table name. */
const SQL_TABLE: Record<SyncTable, string> = {
  assessments: 'assessments',
  goals: 'goals',
  journals: 'journals',
  climbs: 'climbs',
  periods: 'macrocycle_periods',
  benchmarks: 'benchmarks',
  checkins: 'checkins',
};

interface ProfileRow {
  id: string;
  created_at: number;
  updated_at: number;
  ability_tier: string;
  default_discipline: string;
  grade_system: string;
  reassess_weeks: number;
  ai_coach_enabled: number;
}

interface AssessmentRow {
  id: string;
  created_at: number;
  responses: string;
  mental: number;
  technical: number;
  physical: number;
  weakest_area: string;
}

interface EventRow {
  id: string;
  name: string;
  props: string;
  timestamp: number;
}

interface TombstoneRow {
  table_name: string;
  id: string;
  deleted_at: number;
}

interface JournalRow {
  id: string;
  created_at: number;
  updated_at: number;
  date: number;
  summary: string | null;
  wins: string | null;
  struggles: string | null;
  activities: string;
  intensity: string | null;
}

interface CheckinRow {
  id: string;
  created_at: number;
  time: number;
  energy: number;
  emotion: number;
  note: string | null;
}

interface ClimbRow {
  id: string;
  created_at: number;
  updated_at: number;
  date: number;
  environment: string;
  discipline: string;
  grade: string;
  outcome: string;
  name: string | null;
  location: string | null;
  notes: string | null;
}

interface MacrocyclePeriodRow {
  id: string;
  created_at: number;
  updated_at: number;
  label: string;
  start_date: number;
  end_date: number;
  focus: string | null;
  objective: string | null;
  notes: string | null;
}

interface BenchmarkRow {
  id: string;
  created_at: number;
  test_id: string;
  side: string | null;
  value: number;
  date: number;
}

interface GoalRow {
  id: string;
  created_at: number;
  updated_at: number;
  horizon: string;
  title: string;
  mission: string | null;
  sacrifice: string | null;
  target_date: number | null;
  triad_area: string | null;
  status: string;
  completed_at: number | null;
}

/**
 * SQLite-backed Repository using expo-sqlite. Schema is created idempotently in
 * {@link init}. Kept deliberately simple (raw SQL) for the MVP; can be migrated
 * to Drizzle later behind this same interface.
 */
export class SqliteRepository implements Repository {
  private db: SQLite.SQLiteDatabase | null = null;

  private getDb(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('SqliteRepository.init() must be called before use');
    return this.db;
  }

  private async recordTombstone(table: SyncTable, id: string): Promise<void> {
    await this.getDb().runAsync(
      `INSERT OR REPLACE INTO tombstones (table_name, id, deleted_at) VALUES (?, ?, ?)`,
      table,
      id,
      Date.now(),
    );
  }

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        responses TEXT NOT NULL,
        mental INTEGER NOT NULL,
        technical INTEGER NOT NULL,
        physical INTEGER NOT NULL,
        weakest_area TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        horizon TEXT NOT NULL,
        title TEXT NOT NULL,
        mission TEXT,
        sacrifice TEXT,
        target_date INTEGER,
        triad_area TEXT,
        status TEXT NOT NULL,
        completed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        date INTEGER NOT NULL,
        summary TEXT,
        wins TEXT,
        struggles TEXT,
        activities TEXT NOT NULL,
        intensity TEXT
      );
      CREATE TABLE IF NOT EXISTS climbs (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        date INTEGER NOT NULL,
        environment TEXT NOT NULL,
        discipline TEXT NOT NULL,
        grade TEXT NOT NULL,
        outcome TEXT NOT NULL,
        name TEXT,
        location TEXT,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS macrocycle_periods (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        label TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        focus TEXT,
        objective TEXT,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS benchmarks (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        test_id TEXT NOT NULL,
        side TEXT,
        value REAL NOT NULL,
        date INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        time INTEGER NOT NULL,
        energy INTEGER NOT NULL,
        emotion INTEGER NOT NULL,
        note TEXT
      );
      CREATE TABLE IF NOT EXISTS profile (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ability_tier TEXT NOT NULL,
        default_discipline TEXT NOT NULL,
        grade_system TEXT NOT NULL,
        reassess_weeks INTEGER NOT NULL,
        ai_coach_enabled INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tombstones (
        table_name TEXT NOT NULL,
        id TEXT NOT NULL,
        deleted_at INTEGER NOT NULL,
        PRIMARY KEY (table_name, id)
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        props TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_journals_date ON journals (date DESC);
      CREATE INDEX IF NOT EXISTS idx_climbs_date ON climbs (date DESC);
      CREATE INDEX IF NOT EXISTS idx_macrocycle_start ON macrocycle_periods (start_date ASC);
      CREATE INDEX IF NOT EXISTS idx_benchmarks_date ON benchmarks (date DESC);
      CREATE INDEX IF NOT EXISTS idx_checkins_time ON checkins (time DESC);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC);
    `);
    log.info('SQLite repository initialised');
  }

  async saveAssessment(input: NewAssessment): Promise<AssessmentRecord> {
    const record: AssessmentRecord = {
      id: newId(),
      createdAt: input.createdAt ?? Date.now(),
      responses: { ...input.responses },
      mental: input.mental,
      technical: input.technical,
      physical: input.physical,
      weakestArea: input.weakestArea,
    };
    await this.getDb().runAsync(
      `INSERT INTO assessments (id, created_at, responses, mental, technical, physical, weakest_area)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      JSON.stringify(record.responses),
      record.mental,
      record.technical,
      record.physical,
      record.weakestArea,
    );
    return record;
  }

  async listAssessments(): Promise<AssessmentRecord[]> {
    const rows = await this.getDb().getAllAsync<AssessmentRow>(
      `SELECT * FROM assessments ORDER BY created_at DESC`,
    );
    return rows.map(rowToAssessment);
  }

  async getAssessment(id: string): Promise<AssessmentRecord | null> {
    const row = await this.getDb().getFirstAsync<AssessmentRow>(
      `SELECT * FROM assessments WHERE id = ?`,
      id,
    );
    return row ? rowToAssessment(row) : null;
  }

  async saveGoal(input: NewGoal): Promise<GoalRecord> {
    const ts = Date.now();
    const createdAt = input.createdAt ?? ts;
    const record: GoalRecord = {
      id: newId(),
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      horizon: input.horizon,
      title: input.title,
      mission: input.mission,
      sacrifice: input.sacrifice,
      targetDate: input.targetDate,
      triadArea: input.triadArea,
      status: input.status ?? 'active',
      completedAt: undefined,
    };
    await this.getDb().runAsync(
      `INSERT INTO goals (id, created_at, updated_at, horizon, title, mission, sacrifice, target_date, triad_area, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.updatedAt,
      record.horizon,
      record.title,
      record.mission ?? null,
      record.sacrifice ?? null,
      record.targetDate ?? null,
      record.triadArea ?? null,
      record.status,
      record.completedAt ?? null,
    );
    return record;
  }

  async listGoals(): Promise<GoalRecord[]> {
    const rows = await this.getDb().getAllAsync<GoalRow>(
      `SELECT * FROM goals ORDER BY created_at DESC`,
    );
    return rows.map(rowToGoal);
  }

  async getGoal(id: string): Promise<GoalRecord | null> {
    const row = await this.getDb().getFirstAsync<GoalRow>(`SELECT * FROM goals WHERE id = ?`, id);
    return row ? rowToGoal(row) : null;
  }

  async updateGoal(id: string, patch: GoalPatch): Promise<GoalRecord | null> {
    const COLUMNS: Record<keyof GoalPatch, string> = {
      horizon: 'horizon',
      title: 'title',
      mission: 'mission',
      sacrifice: 'sacrifice',
      targetDate: 'target_date',
      triadArea: 'triad_area',
      status: 'status',
      completedAt: 'completed_at',
    };
    const existing = await this.getGoal(id);
    if (!existing) return null;
    const sets: string[] = ['updated_at = ?'];
    const values: SQLite.SQLiteBindValue[] = [Math.max(Date.now(), existing.updatedAt + 1)];
    (Object.keys(patch) as (keyof GoalPatch)[]).forEach((key) => {
      sets.push(`${COLUMNS[key]} = ?`);
      values.push(patch[key] ?? null);
    });
    values.push(id);
    await this.getDb().runAsync(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`, ...values);
    return this.getGoal(id);
  }

  async deleteGoal(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM goals WHERE id = ?`, id);
    await this.recordTombstone('goals', id);
  }

  async saveJournal(input: NewJournal): Promise<JournalEntry> {
    const ts = Date.now();
    const record: JournalEntry = {
      id: newId(),
      createdAt: input.createdAt ?? ts,
      updatedAt: input.updatedAt ?? ts,
      date: input.date,
      summary: input.summary,
      wins: input.wins,
      struggles: input.struggles,
      activities: [...input.activities],
      intensity: input.intensity,
    };
    await this.getDb().runAsync(
      `INSERT INTO journals (id, created_at, updated_at, date, summary, wins, struggles, activities, intensity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.updatedAt,
      record.date,
      record.summary ?? null,
      record.wins ?? null,
      record.struggles ?? null,
      JSON.stringify(record.activities),
      record.intensity ?? null,
    );
    return record;
  }

  async listJournals(): Promise<JournalEntry[]> {
    const rows = await this.getDb().getAllAsync<JournalRow>(
      `SELECT * FROM journals ORDER BY date DESC`,
    );
    return rows.map(rowToJournal);
  }

  async getJournal(id: string): Promise<JournalEntry | null> {
    const row = await this.getDb().getFirstAsync<JournalRow>(
      `SELECT * FROM journals WHERE id = ?`,
      id,
    );
    return row ? rowToJournal(row) : null;
  }

  async updateJournal(id: string, patch: JournalPatch): Promise<JournalEntry | null> {
    const COLUMNS: Record<keyof JournalPatch, string> = {
      date: 'date',
      summary: 'summary',
      wins: 'wins',
      struggles: 'struggles',
      activities: 'activities',
      intensity: 'intensity',
    };
    const existing = await this.getJournal(id);
    if (!existing) return null;
    const sets: string[] = ['updated_at = ?'];
    const values: SQLite.SQLiteBindValue[] = [Math.max(Date.now(), existing.updatedAt + 1)];
    (Object.keys(patch) as (keyof JournalPatch)[]).forEach((key) => {
      sets.push(`${COLUMNS[key]} = ?`);
      if (key === 'activities') {
        values.push(JSON.stringify(patch.activities ?? []));
      } else {
        values.push(patch[key] ?? null);
      }
    });
    values.push(id);
    await this.getDb().runAsync(`UPDATE journals SET ${sets.join(', ')} WHERE id = ?`, ...values);
    return this.getJournal(id);
  }

  async deleteJournal(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM journals WHERE id = ?`, id);
    await this.recordTombstone('journals', id);
  }

  async saveClimb(input: NewClimb): Promise<ClimbRecord> {
    const ts = Date.now();
    const record: ClimbRecord = {
      id: newId(),
      createdAt: input.createdAt ?? ts,
      updatedAt: input.updatedAt ?? ts,
      date: input.date,
      environment: input.environment,
      discipline: input.discipline,
      grade: input.grade,
      outcome: input.outcome,
      name: input.name,
      location: input.location,
      notes: input.notes,
    };
    await this.getDb().runAsync(
      `INSERT INTO climbs (id, created_at, updated_at, date, environment, discipline, grade, outcome, name, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.updatedAt,
      record.date,
      record.environment,
      record.discipline,
      record.grade,
      record.outcome,
      record.name ?? null,
      record.location ?? null,
      record.notes ?? null,
    );
    return record;
  }

  async listClimbs(): Promise<ClimbRecord[]> {
    const rows = await this.getDb().getAllAsync<ClimbRow>(
      `SELECT * FROM climbs ORDER BY date DESC`,
    );
    return rows.map(rowToClimb);
  }

  async getClimb(id: string): Promise<ClimbRecord | null> {
    const row = await this.getDb().getFirstAsync<ClimbRow>(`SELECT * FROM climbs WHERE id = ?`, id);
    return row ? rowToClimb(row) : null;
  }

  async updateClimb(id: string, patch: ClimbPatch): Promise<ClimbRecord | null> {
    const COLUMNS: Record<keyof ClimbPatch, string> = {
      date: 'date',
      environment: 'environment',
      discipline: 'discipline',
      grade: 'grade',
      outcome: 'outcome',
      name: 'name',
      location: 'location',
      notes: 'notes',
    };
    const existing = await this.getClimb(id);
    if (!existing) return null;
    const sets: string[] = ['updated_at = ?'];
    const values: SQLite.SQLiteBindValue[] = [Math.max(Date.now(), existing.updatedAt + 1)];
    (Object.keys(patch) as (keyof ClimbPatch)[]).forEach((key) => {
      sets.push(`${COLUMNS[key]} = ?`);
      values.push(patch[key] ?? null);
    });
    values.push(id);
    await this.getDb().runAsync(`UPDATE climbs SET ${sets.join(', ')} WHERE id = ?`, ...values);
    return this.getClimb(id);
  }

  async deleteClimb(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM climbs WHERE id = ?`, id);
    await this.recordTombstone('climbs', id);
  }

  async saveMacrocyclePeriod(input: NewMacrocyclePeriod): Promise<MacrocyclePeriodRecord> {
    const ts = Date.now();
    const createdAt = input.createdAt ?? ts;
    const record: MacrocyclePeriodRecord = {
      id: newId(),
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      label: input.label,
      startDate: input.startDate,
      endDate: input.endDate,
      focus: input.focus,
      objective: input.objective,
      notes: input.notes,
    };
    await this.getDb().runAsync(
      `INSERT INTO macrocycle_periods (id, created_at, updated_at, label, start_date, end_date, focus, objective, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.updatedAt,
      record.label,
      record.startDate,
      record.endDate,
      record.focus ?? null,
      record.objective ?? null,
      record.notes ?? null,
    );
    return record;
  }

  async listMacrocyclePeriods(): Promise<MacrocyclePeriodRecord[]> {
    const rows = await this.getDb().getAllAsync<MacrocyclePeriodRow>(
      `SELECT * FROM macrocycle_periods ORDER BY start_date ASC`,
    );
    return rows.map(rowToPeriod);
  }

  async getMacrocyclePeriod(id: string): Promise<MacrocyclePeriodRecord | null> {
    const row = await this.getDb().getFirstAsync<MacrocyclePeriodRow>(
      `SELECT * FROM macrocycle_periods WHERE id = ?`,
      id,
    );
    return row ? rowToPeriod(row) : null;
  }

  async updateMacrocyclePeriod(
    id: string,
    patch: MacrocyclePeriodPatch,
  ): Promise<MacrocyclePeriodRecord | null> {
    const COLUMNS: Record<keyof MacrocyclePeriodPatch, string> = {
      label: 'label',
      startDate: 'start_date',
      endDate: 'end_date',
      focus: 'focus',
      objective: 'objective',
      notes: 'notes',
    };
    const existing = await this.getMacrocyclePeriod(id);
    if (!existing) return null;
    const sets: string[] = ['updated_at = ?'];
    const values: SQLite.SQLiteBindValue[] = [Math.max(Date.now(), existing.updatedAt + 1)];
    (Object.keys(patch) as (keyof MacrocyclePeriodPatch)[]).forEach((key) => {
      sets.push(`${COLUMNS[key]} = ?`);
      values.push(patch[key] ?? null);
    });
    values.push(id);
    await this.getDb().runAsync(
      `UPDATE macrocycle_periods SET ${sets.join(', ')} WHERE id = ?`,
      ...values,
    );
    return this.getMacrocyclePeriod(id);
  }

  async deleteMacrocyclePeriod(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM macrocycle_periods WHERE id = ?`, id);
    await this.recordTombstone('periods', id);
  }

  async saveBenchmark(input: NewBenchmark): Promise<BenchmarkRecord> {
    const record: BenchmarkRecord = {
      id: newId(),
      createdAt: input.createdAt ?? Date.now(),
      testId: input.testId,
      side: input.side,
      value: input.value,
      date: input.date,
    };
    await this.getDb().runAsync(
      `INSERT INTO benchmarks (id, created_at, test_id, side, value, date) VALUES (?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.testId,
      record.side ?? null,
      record.value,
      record.date,
    );
    return record;
  }

  async listBenchmarks(): Promise<BenchmarkRecord[]> {
    const rows = await this.getDb().getAllAsync<BenchmarkRow>(
      `SELECT * FROM benchmarks ORDER BY date DESC`,
    );
    return rows.map(rowToBenchmark);
  }

  async deleteBenchmark(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM benchmarks WHERE id = ?`, id);
    await this.recordTombstone('benchmarks', id);
  }

  async saveCheckin(input: NewCheckin): Promise<CheckinRecord> {
    const record: CheckinRecord = {
      id: newId(),
      createdAt: input.createdAt ?? Date.now(),
      time: input.time,
      energy: input.energy,
      emotion: input.emotion,
      note: input.note,
    };
    await this.getDb().runAsync(
      `INSERT INTO checkins (id, created_at, time, energy, emotion, note) VALUES (?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
      record.time,
      record.energy,
      record.emotion,
      record.note ?? null,
    );
    return record;
  }

  async listCheckins(): Promise<CheckinRecord[]> {
    const rows = await this.getDb().getAllAsync<CheckinRow>(
      `SELECT * FROM checkins ORDER BY time DESC`,
    );
    return rows.map(rowToCheckin);
  }

  async deleteCheckin(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM checkins WHERE id = ?`, id);
    await this.recordTombstone('checkins', id);
  }

  async getProfile(): Promise<ProfileRecord | null> {
    const row = await this.getDb().getFirstAsync<ProfileRow>(
      `SELECT * FROM profile WHERE id = ?`,
      PROFILE_ID,
    );
    return row ? rowToProfile(row) : null;
  }

  async saveProfile(patch: ProfilePatch): Promise<ProfileRecord> {
    const existing = await this.getProfile();
    const ts = Date.now();
    const record: ProfileRecord = {
      id: PROFILE_ID,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: existing ? Math.max(ts, existing.updatedAt + 1) : ts,
      abilityTier: patch.abilityTier ?? existing?.abilityTier ?? PROFILE_DEFAULTS.abilityTier,
      defaultDiscipline:
        patch.defaultDiscipline ??
        existing?.defaultDiscipline ??
        PROFILE_DEFAULTS.defaultDiscipline,
      gradeSystem: patch.gradeSystem ?? existing?.gradeSystem ?? PROFILE_DEFAULTS.gradeSystem,
      reassessWeeks:
        patch.reassessWeeks ?? existing?.reassessWeeks ?? PROFILE_DEFAULTS.reassessWeeks,
      aiCoachEnabled:
        patch.aiCoachEnabled ?? existing?.aiCoachEnabled ?? PROFILE_DEFAULTS.aiCoachEnabled,
    };
    await this.upsertProfileRow(record);
    return record;
  }

  private async upsertProfileRow(p: ProfileRecord): Promise<void> {
    await this.getDb().runAsync(
      `INSERT OR REPLACE INTO profile (id, created_at, updated_at, ability_tier, default_discipline, grade_system, reassess_weeks, ai_coach_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id,
      p.createdAt,
      p.updatedAt,
      p.abilityTier,
      p.defaultDiscipline,
      p.gradeSystem,
      p.reassessWeeks,
      p.aiCoachEnabled ? 1 : 0,
    );
  }

  async exportSnapshot(): Promise<Snapshot> {
    const [assessments, goals, journals, climbs, periods, benchmarks, checkins, tombRows] =
      await Promise.all([
        this.listAssessments(),
        this.listGoals(),
        this.listJournals(),
        this.listClimbs(),
        this.listMacrocyclePeriods(),
        this.listBenchmarks(),
        this.listCheckins(),
        this.getDb().getAllAsync<TombstoneRow>(`SELECT * FROM tombstones`),
      ]);
    const tombstones: TombstoneRecord[] = tombRows.map((t) => ({
      table: t.table_name as SyncTable,
      id: t.id,
      deletedAt: t.deleted_at,
    }));
    const profile = await this.getProfile();
    return {
      assessments,
      goals,
      journals,
      climbs,
      periods,
      benchmarks,
      checkins,
      profile,
      tombstones,
    };
  }

  async applySnapshot(snapshot: Snapshot): Promise<void> {
    const db = this.getDb();
    await db.withTransactionAsync(async () => {
      for (const a of snapshot.assessments) {
        await db.runAsync(
          `INSERT OR REPLACE INTO assessments (id, created_at, responses, mental, technical, physical, weakest_area)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          a.id,
          a.createdAt,
          JSON.stringify(a.responses),
          a.mental,
          a.technical,
          a.physical,
          a.weakestArea,
        );
      }
      for (const g of snapshot.goals) {
        await db.runAsync(
          `INSERT OR REPLACE INTO goals (id, created_at, updated_at, horizon, title, mission, sacrifice, target_date, triad_area, status, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          g.id,
          g.createdAt,
          g.updatedAt,
          g.horizon,
          g.title,
          g.mission ?? null,
          g.sacrifice ?? null,
          g.targetDate ?? null,
          g.triadArea ?? null,
          g.status,
          g.completedAt ?? null,
        );
      }
      for (const j of snapshot.journals) {
        await db.runAsync(
          `INSERT OR REPLACE INTO journals (id, created_at, updated_at, date, summary, wins, struggles, activities, intensity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          j.id,
          j.createdAt,
          j.updatedAt,
          j.date,
          j.summary ?? null,
          j.wins ?? null,
          j.struggles ?? null,
          JSON.stringify(j.activities),
          j.intensity ?? null,
        );
      }
      for (const c of snapshot.climbs) {
        await db.runAsync(
          `INSERT OR REPLACE INTO climbs (id, created_at, updated_at, date, environment, discipline, grade, outcome, name, location, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          c.id,
          c.createdAt,
          c.updatedAt,
          c.date,
          c.environment,
          c.discipline,
          c.grade,
          c.outcome,
          c.name ?? null,
          c.location ?? null,
          c.notes ?? null,
        );
      }
      for (const p of snapshot.periods) {
        await db.runAsync(
          `INSERT OR REPLACE INTO macrocycle_periods (id, created_at, updated_at, label, start_date, end_date, focus, objective, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          p.createdAt,
          p.updatedAt,
          p.label,
          p.startDate,
          p.endDate,
          p.focus ?? null,
          p.objective ?? null,
          p.notes ?? null,
        );
      }
      for (const b of snapshot.benchmarks) {
        await db.runAsync(
          `INSERT OR REPLACE INTO benchmarks (id, created_at, test_id, side, value, date) VALUES (?, ?, ?, ?, ?, ?)`,
          b.id,
          b.createdAt,
          b.testId,
          b.side ?? null,
          b.value,
          b.date,
        );
      }
      for (const c of snapshot.checkins) {
        await db.runAsync(
          `INSERT OR REPLACE INTO checkins (id, created_at, time, energy, emotion, note) VALUES (?, ?, ?, ?, ?, ?)`,
          c.id,
          c.createdAt,
          c.time,
          c.energy,
          c.emotion,
          c.note ?? null,
        );
      }
      // Profile (singleton) — keep whichever is newer.
      if (snapshot.profile) {
        const p = snapshot.profile;
        await db.runAsync(
          `INSERT INTO profile (id, created_at, updated_at, ability_tier, default_discipline, grade_system, reassess_weeks, ai_coach_enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             ability_tier = excluded.ability_tier,
             default_discipline = excluded.default_discipline,
             grade_system = excluded.grade_system,
             reassess_weeks = excluded.reassess_weeks,
             ai_coach_enabled = excluded.ai_coach_enabled
           WHERE excluded.updated_at >= profile.updated_at`,
          p.id,
          p.createdAt,
          p.updatedAt,
          p.abilityTier,
          p.defaultDiscipline,
          p.gradeSystem,
          p.reassessWeeks,
          p.aiCoachEnabled ? 1 : 0,
        );
      }
      // Apply deletions, then persist the tombstones.
      for (const t of snapshot.tombstones) {
        await db.runAsync(`DELETE FROM ${SQL_TABLE[t.table]} WHERE id = ?`, t.id);
        await db.runAsync(
          `INSERT OR REPLACE INTO tombstones (table_name, id, deleted_at)
           VALUES (?, ?, MAX(?, COALESCE((SELECT deleted_at FROM tombstones WHERE table_name = ? AND id = ?), 0)))`,
          t.table,
          t.id,
          t.deletedAt,
          t.table,
          t.id,
        );
      }
    });
  }

  async recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void> {
    await this.getDb().runAsync(
      `INSERT INTO events (id, name, props, timestamp) VALUES (?, ?, ?, ?)`,
      newId(),
      event.name,
      JSON.stringify(event.props),
      event.timestamp,
    );
  }

  async listEvents(limit?: number): Promise<UsageEventRecord[]> {
    const sql = `SELECT * FROM events ORDER BY timestamp DESC${typeof limit === 'number' ? ' LIMIT ?' : ''}`;
    const rows =
      typeof limit === 'number'
        ? await this.getDb().getAllAsync<EventRow>(sql, limit)
        : await this.getDb().getAllAsync<EventRow>(sql);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      props: safeParse<Record<string, unknown>>(r.props, {}),
      timestamp: r.timestamp,
    }));
  }
}

function rowToProfile(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    abilityTier: row.ability_tier as AbilityTier,
    defaultDiscipline: row.default_discipline as ClimbDiscipline,
    gradeSystem: row.grade_system as GradeSystem,
    reassessWeeks: row.reassess_weeks,
    aiCoachEnabled: row.ai_coach_enabled === 1,
  };
}

function rowToAssessment(row: AssessmentRow): AssessmentRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    responses: safeParse<Responses>(row.responses, {}),
    mental: row.mental,
    technical: row.technical,
    physical: row.physical,
    weakestArea: row.weakest_area as TriadArea,
  };
}

function rowToGoal(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    horizon: row.horizon as GoalHorizon,
    title: row.title,
    mission: row.mission ?? undefined,
    sacrifice: row.sacrifice ?? undefined,
    targetDate: row.target_date ?? undefined,
    triadArea: (row.triad_area as TriadArea | null) ?? undefined,
    status: row.status as GoalStatus,
    completedAt: row.completed_at ?? undefined,
  };
}

function rowToJournal(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    date: row.date,
    summary: row.summary ?? undefined,
    wins: row.wins ?? undefined,
    struggles: row.struggles ?? undefined,
    activities: safeParse<ActivityTag[]>(row.activities, []),
    intensity: (row.intensity as JournalIntensity | null) ?? undefined,
  };
}

function rowToClimb(row: ClimbRow): ClimbRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    date: row.date,
    environment: row.environment as ClimbEnvironment,
    discipline: row.discipline as ClimbDiscipline,
    grade: row.grade,
    outcome: row.outcome as ClimbOutcome,
    name: row.name ?? undefined,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function rowToPeriod(row: MacrocyclePeriodRow): MacrocyclePeriodRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    focus: row.focus ?? undefined,
    objective: row.objective ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function rowToBenchmark(row: BenchmarkRow): BenchmarkRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    testId: row.test_id,
    side: (row.side as 'left' | 'right' | null) ?? undefined,
    value: row.value,
    date: row.date,
  };
}

function rowToCheckin(row: CheckinRow): CheckinRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    time: row.time,
    energy: row.energy,
    emotion: row.emotion,
    note: row.note ?? undefined,
  };
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
