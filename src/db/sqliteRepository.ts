import * as SQLite from 'expo-sqlite';

import { log } from '../lib/logger';
import { newId } from '../lib/ids';
import type { TriadArea } from '../content/types';
import type { GoalHorizon, GoalStatus } from '../content/planning';
import type { Responses } from '../features/assess/scoring';
import type { Repository } from './repository';
import type {
  AssessmentRecord,
  GoalPatch,
  GoalRecord,
  NewAssessment,
  NewGoal,
  UsageEventRecord,
} from './types';

const DB_NAME = 'training-for-climbing.db';

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

interface GoalRow {
  id: string;
  created_at: number;
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
        horizon TEXT NOT NULL,
        title TEXT NOT NULL,
        mission TEXT,
        sacrifice TEXT,
        target_date INTEGER,
        triad_area TEXT,
        status TEXT NOT NULL,
        completed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        props TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals (created_at DESC);
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
    const record: GoalRecord = {
      id: newId(),
      createdAt: input.createdAt ?? Date.now(),
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
      `INSERT INTO goals (id, created_at, horizon, title, mission, sacrifice, target_date, triad_area, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.createdAt,
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
    const sets: string[] = [];
    const values: SQLite.SQLiteBindValue[] = [];
    (Object.keys(patch) as (keyof GoalPatch)[]).forEach((key) => {
      sets.push(`${COLUMNS[key]} = ?`);
      values.push(patch[key] ?? null);
    });
    if (sets.length > 0) {
      values.push(id);
      await this.getDb().runAsync(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`, ...values);
    }
    return this.getGoal(id);
  }

  async deleteGoal(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM goals WHERE id = ?`, id);
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

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
