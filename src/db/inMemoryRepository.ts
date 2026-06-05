import { newId } from '../lib/ids';
import type { Repository } from './repository';
import type {
  AssessmentRecord,
  GoalPatch,
  GoalRecord,
  NewAssessment,
  NewGoal,
  NewSession,
  SessionRecord,
  UsageEventRecord,
} from './types';

/**
 * In-memory Repository. Used in unit tests and as a safe fallback (e.g. web,
 * or before the native DB is ready). Not persistent.
 */
export class InMemoryRepository implements Repository {
  private assessments: AssessmentRecord[] = [];
  private goals: GoalRecord[] = [];
  private sessions: SessionRecord[] = [];
  private events: UsageEventRecord[] = [];

  async init(): Promise<void> {
    // no-op
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
    this.assessments.push(record);
    return record;
  }

  async listAssessments(): Promise<AssessmentRecord[]> {
    return [...this.assessments].sort((a, b) => b.createdAt - a.createdAt);
  }

  async getAssessment(id: string): Promise<AssessmentRecord | null> {
    return this.assessments.find((a) => a.id === id) ?? null;
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
    this.goals.push(record);
    return record;
  }

  async listGoals(): Promise<GoalRecord[]> {
    return [...this.goals].sort((a, b) => b.createdAt - a.createdAt);
  }

  async getGoal(id: string): Promise<GoalRecord | null> {
    return this.goals.find((g) => g.id === id) ?? null;
  }

  async updateGoal(id: string, patch: GoalPatch): Promise<GoalRecord | null> {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return null;
    Object.assign(goal, patch);
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== id);
  }

  async saveSession(input: NewSession): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: newId(),
      createdAt: input.createdAt ?? Date.now(),
      date: input.date,
      focusAreas: [...input.focusAreas],
      notes: input.notes,
    };
    this.sessions.push(record);
    return record;
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.sessions].sort((a, b) => b.date - a.date);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  async recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void> {
    this.events.push({ id: newId(), ...event });
  }

  async listEvents(limit?: number): Promise<UsageEventRecord[]> {
    const sorted = [...this.events].sort((a, b) => b.timestamp - a.timestamp);
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }
}
