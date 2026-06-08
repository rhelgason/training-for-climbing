import { newId } from '../lib/ids';
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
  NewAssessment,
  NewBenchmark,
  NewCheckin,
  NewClimb,
  NewGoal,
  NewMacrocyclePeriod,
  NewSession,
  ProfilePatch,
  ProfileRecord,
  SessionRecord,
  Snapshot,
  SyncTable,
  TombstoneRecord,
  UsageEventRecord,
} from './types';
import { PROFILE_DEFAULTS, PROFILE_ID } from '../content/profile';

/**
 * In-memory Repository. Used in unit tests and as a safe fallback (e.g. web,
 * or before the native DB is ready). Not persistent.
 */
export class InMemoryRepository implements Repository {
  private assessments: AssessmentRecord[] = [];
  private goals: GoalRecord[] = [];
  private sessions: SessionRecord[] = [];
  private climbs: ClimbRecord[] = [];
  private periods: MacrocyclePeriodRecord[] = [];
  private benchmarks: BenchmarkRecord[] = [];
  private checkins: CheckinRecord[] = [];
  private profile: ProfileRecord | null = null;
  private tombstones: TombstoneRecord[] = [];
  private events: UsageEventRecord[] = [];

  async init(): Promise<void> {
    // no-op
  }

  private tombstone(table: SyncTable, id: string): void {
    this.tombstones = this.tombstones.filter((t) => !(t.table === table && t.id === id));
    this.tombstones.push({ table, id, deletedAt: Date.now() });
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
    // Monotonic: an edit is always strictly newer than the version it edited,
    // so last-write-wins sync is unambiguous even within the same millisecond.
    Object.assign(goal, patch, { updatedAt: Math.max(Date.now(), goal.updatedAt + 1) });
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== id);
    this.tombstone('goals', id);
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
    this.tombstone('sessions', id);
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
    this.climbs.push(record);
    return record;
  }

  async listClimbs(): Promise<ClimbRecord[]> {
    return [...this.climbs].sort((a, b) => b.date - a.date);
  }

  async getClimb(id: string): Promise<ClimbRecord | null> {
    return this.climbs.find((c) => c.id === id) ?? null;
  }

  async updateClimb(id: string, patch: ClimbPatch): Promise<ClimbRecord | null> {
    const climb = this.climbs.find((c) => c.id === id);
    if (!climb) return null;
    Object.assign(climb, patch, { updatedAt: Math.max(Date.now(), climb.updatedAt + 1) });
    return climb;
  }

  async deleteClimb(id: string): Promise<void> {
    this.climbs = this.climbs.filter((c) => c.id !== id);
    this.tombstone('climbs', id);
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
    this.periods.push(record);
    return record;
  }

  async listMacrocyclePeriods(): Promise<MacrocyclePeriodRecord[]> {
    return [...this.periods].sort((a, b) => a.startDate - b.startDate);
  }

  async getMacrocyclePeriod(id: string): Promise<MacrocyclePeriodRecord | null> {
    return this.periods.find((p) => p.id === id) ?? null;
  }

  async updateMacrocyclePeriod(
    id: string,
    patch: MacrocyclePeriodPatch,
  ): Promise<MacrocyclePeriodRecord | null> {
    const period = this.periods.find((p) => p.id === id);
    if (!period) return null;
    Object.assign(period, patch, { updatedAt: Math.max(Date.now(), period.updatedAt + 1) });
    return period;
  }

  async deleteMacrocyclePeriod(id: string): Promise<void> {
    this.periods = this.periods.filter((p) => p.id !== id);
    this.tombstone('periods', id);
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
    this.benchmarks.push(record);
    return record;
  }

  async listBenchmarks(): Promise<BenchmarkRecord[]> {
    return [...this.benchmarks].sort((a, b) => b.date - a.date);
  }

  async deleteBenchmark(id: string): Promise<void> {
    this.benchmarks = this.benchmarks.filter((b) => b.id !== id);
    this.tombstone('benchmarks', id);
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
    this.checkins.push(record);
    return record;
  }

  async listCheckins(): Promise<CheckinRecord[]> {
    return [...this.checkins].sort((a, b) => b.time - a.time);
  }

  async deleteCheckin(id: string): Promise<void> {
    this.checkins = this.checkins.filter((c) => c.id !== id);
    this.tombstone('checkins', id);
  }

  async getProfile(): Promise<ProfileRecord | null> {
    return this.profile;
  }

  async saveProfile(patch: ProfilePatch): Promise<ProfileRecord> {
    const ts = Date.now();
    const base: ProfileRecord = this.profile ?? {
      id: PROFILE_ID,
      createdAt: ts,
      updatedAt: ts,
      ...PROFILE_DEFAULTS,
    };
    this.profile = {
      ...base,
      ...patch,
      id: PROFILE_ID,
      createdAt: base.createdAt,
      updatedAt: this.profile ? Math.max(ts, this.profile.updatedAt + 1) : ts,
    };
    return this.profile;
  }

  async exportSnapshot(): Promise<Snapshot> {
    return {
      assessments: [...this.assessments],
      goals: [...this.goals],
      sessions: [...this.sessions],
      climbs: [...this.climbs],
      periods: [...this.periods],
      benchmarks: [...this.benchmarks],
      checkins: [...this.checkins],
      profile: this.profile,
      tombstones: [...this.tombstones],
    };
  }

  async applySnapshot(snapshot: Snapshot): Promise<void> {
    const upsert = <T extends { id: string }>(list: T[], incoming: T[]): T[] => {
      const byId = new Map(list.map((r) => [r.id, r]));
      for (const r of incoming) byId.set(r.id, r);
      return [...byId.values()];
    };
    this.assessments = upsert(this.assessments, snapshot.assessments);
    this.goals = upsert(this.goals, snapshot.goals);
    this.sessions = upsert(this.sessions, snapshot.sessions);
    this.climbs = upsert(this.climbs, snapshot.climbs);
    this.periods = upsert(this.periods, snapshot.periods);
    this.benchmarks = upsert(this.benchmarks, snapshot.benchmarks);
    this.checkins = upsert(this.checkins, snapshot.checkins);
    if (
      snapshot.profile &&
      (!this.profile || snapshot.profile.updatedAt >= this.profile.updatedAt)
    ) {
      this.profile = snapshot.profile;
    }

    // Apply deletions, then remember the tombstones.
    const removals: Record<SyncTable, (id: string) => void> = {
      assessments: (id) => (this.assessments = this.assessments.filter((r) => r.id !== id)),
      goals: (id) => (this.goals = this.goals.filter((r) => r.id !== id)),
      sessions: (id) => (this.sessions = this.sessions.filter((r) => r.id !== id)),
      climbs: (id) => (this.climbs = this.climbs.filter((r) => r.id !== id)),
      periods: (id) => (this.periods = this.periods.filter((r) => r.id !== id)),
      benchmarks: (id) => (this.benchmarks = this.benchmarks.filter((r) => r.id !== id)),
      checkins: (id) => (this.checkins = this.checkins.filter((r) => r.id !== id)),
    };
    for (const t of snapshot.tombstones) {
      removals[t.table](t.id);
      const existing = this.tombstones.find((x) => x.table === t.table && x.id === t.id);
      if (!existing || t.deletedAt > existing.deletedAt) {
        this.tombstones = this.tombstones.filter((x) => !(x.table === t.table && x.id === t.id));
        this.tombstones.push({ ...t });
      }
    }
  }

  async recordEvent(event: Omit<UsageEventRecord, 'id'>): Promise<void> {
    this.events.push({ id: newId(), ...event });
  }

  async listEvents(limit?: number): Promise<UsageEventRecord[]> {
    const sorted = [...this.events].sort((a, b) => b.timestamp - a.timestamp);
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }
}
