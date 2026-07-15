/**
 * Browser-persistent Repository. Reuses @tfc/core's InMemoryRepository for all
 * the logic and adds durability: hydrate the in-memory state from IndexedDB on
 * init, and write the full snapshot back (debounced) after every mutation.
 *
 * The snapshot round-trip (exportSnapshot/applySnapshot) is the same one the
 * cloud-sync engine uses, so persistence and sync share one code path.
 */
import {
  InMemoryRepository,
  type AssessmentRecord,
  type BenchmarkRecord,
  type CheckinRecord,
  type ClimbPatch,
  type ClimbRecord,
  type GoalPatch,
  type GoalRecord,
  type JournalEntry,
  type JournalPatch,
  type MacrocyclePeriodPatch,
  type MacrocyclePeriodRecord,
  type NewAssessment,
  type NewBenchmark,
  type NewCheckin,
  type NewClimb,
  type NewGoal,
  type NewJournal,
  type NewMacrocyclePeriod,
  type ProfilePatch,
  type ProfileRecord,
  type Snapshot,
  log,
} from '@tfc/core';
import { loadSnapshot, saveSnapshot } from './webSnapshotStore';

const PERSIST_DEBOUNCE_MS = 400;

export class WebRepository extends InMemoryRepository {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = false;

  async init(): Promise<void> {
    await super.init();
    try {
      const snap = await loadSnapshot();
      if (snap) await super.applySnapshot(snap);
    } catch (err) {
      log.error('web repo: failed to hydrate from IndexedDB', err);
    }
  }

  /** Write the current snapshot to IndexedDB, coalescing bursts of edits. */
  private schedulePersist(): void {
    this.pending = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), PERSIST_DEBOUNCE_MS);
  }

  /** Immediately persist any pending changes (e.g. on beforeunload). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    this.pending = false;
    try {
      const snapshot = await super.exportSnapshot();
      await saveSnapshot(snapshot);
    } catch (err) {
      this.pending = true;
      log.error('web repo: failed to persist snapshot', err);
    }
  }

  // --- Mutators: run the in-memory op, then schedule a persist. ---

  async saveAssessment(input: NewAssessment): Promise<AssessmentRecord> {
    const r = await super.saveAssessment(input);
    this.schedulePersist();
    return r;
  }

  async saveGoal(input: NewGoal): Promise<GoalRecord> {
    const r = await super.saveGoal(input);
    this.schedulePersist();
    return r;
  }

  async updateGoal(id: string, patch: GoalPatch): Promise<GoalRecord | null> {
    const r = await super.updateGoal(id, patch);
    this.schedulePersist();
    return r;
  }

  async deleteGoal(id: string): Promise<void> {
    await super.deleteGoal(id);
    this.schedulePersist();
  }

  async saveJournal(input: NewJournal): Promise<JournalEntry> {
    const r = await super.saveJournal(input);
    this.schedulePersist();
    return r;
  }

  async updateJournal(id: string, patch: JournalPatch): Promise<JournalEntry | null> {
    const r = await super.updateJournal(id, patch);
    this.schedulePersist();
    return r;
  }

  async deleteJournal(id: string): Promise<void> {
    await super.deleteJournal(id);
    this.schedulePersist();
  }

  async saveClimb(input: NewClimb): Promise<ClimbRecord> {
    const r = await super.saveClimb(input);
    this.schedulePersist();
    return r;
  }

  async updateClimb(id: string, patch: ClimbPatch): Promise<ClimbRecord | null> {
    const r = await super.updateClimb(id, patch);
    this.schedulePersist();
    return r;
  }

  async deleteClimb(id: string): Promise<void> {
    await super.deleteClimb(id);
    this.schedulePersist();
  }

  async saveMacrocyclePeriod(input: NewMacrocyclePeriod): Promise<MacrocyclePeriodRecord> {
    const r = await super.saveMacrocyclePeriod(input);
    this.schedulePersist();
    return r;
  }

  async updateMacrocyclePeriod(
    id: string,
    patch: MacrocyclePeriodPatch,
  ): Promise<MacrocyclePeriodRecord | null> {
    const r = await super.updateMacrocyclePeriod(id, patch);
    this.schedulePersist();
    return r;
  }

  async deleteMacrocyclePeriod(id: string): Promise<void> {
    await super.deleteMacrocyclePeriod(id);
    this.schedulePersist();
  }

  async saveBenchmark(input: NewBenchmark): Promise<BenchmarkRecord> {
    const r = await super.saveBenchmark(input);
    this.schedulePersist();
    return r;
  }

  async deleteBenchmark(id: string): Promise<void> {
    await super.deleteBenchmark(id);
    this.schedulePersist();
  }

  async saveCheckin(input: NewCheckin): Promise<CheckinRecord> {
    const r = await super.saveCheckin(input);
    this.schedulePersist();
    return r;
  }

  async deleteCheckin(id: string): Promise<void> {
    await super.deleteCheckin(id);
    this.schedulePersist();
  }

  async saveProfile(patch: ProfilePatch): Promise<ProfileRecord> {
    const r = await super.saveProfile(patch);
    this.schedulePersist();
    return r;
  }

  async applySnapshot(snapshot: Snapshot): Promise<void> {
    await super.applySnapshot(snapshot);
    this.schedulePersist();
  }
}
