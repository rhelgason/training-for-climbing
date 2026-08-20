import { InMemoryRepository } from './inMemoryRepository';
import type { NewAssessment, NewGoal, NewJournal } from './types';

function sampleAssessment(overrides: Partial<NewAssessment> = {}): NewAssessment {
  return {
    responses: { 1: 5, 2: 3, 3: 4 },
    mental: 40,
    technical: 30,
    physical: 45,
    weakestArea: 'technical',
    ...overrides,
  };
}

describe('InMemoryRepository', () => {
  it('saves an assessment and returns it with id + createdAt', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const saved = await repo.saveAssessment(sampleAssessment());
    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.weakestArea).toBe('technical');
  });

  it('lists assessments newest-first', async () => {
    const repo = new InMemoryRepository();
    const older = await repo.saveAssessment(sampleAssessment({ createdAt: 1000 }));
    const newer = await repo.saveAssessment(sampleAssessment({ createdAt: 2000 }));
    const list = await repo.listAssessments();
    expect(list.map((a) => a.id)).toEqual([newer.id, older.id]);
  });

  it('retrieves an assessment by id and returns null when missing', async () => {
    const repo = new InMemoryRepository();
    const saved = await repo.saveAssessment(sampleAssessment());
    expect(await repo.getAssessment(saved.id)).toEqual(saved);
    expect(await repo.getAssessment('does-not-exist')).toBeNull();
  });

  it('copies responses so later mutation of the input does not affect the record', async () => {
    const repo = new InMemoryRepository();
    const input = sampleAssessment();
    const saved = await repo.saveAssessment(input);
    input.responses[1] = 0;
    expect(saved.responses[1]).toBe(5);
  });

  it('saves a goal with defaults and lists newest-first', async () => {
    const repo = new InMemoryRepository();
    const newGoal: NewGoal = { horizon: 'medium', title: 'Redpoint my first 5.11' };
    const older = await repo.saveGoal({ ...newGoal, createdAt: 1000 });
    const newer = await repo.saveGoal({ ...newGoal, createdAt: 2000, title: 'Send the project' });
    expect(older.status).toBe('active');
    const list = await repo.listGoals();
    expect(list.map((g) => g.id)).toEqual([newer.id, older.id]);
  });

  it('updates a goal and returns null for unknown ids', async () => {
    const repo = new InMemoryRepository();
    const goal = await repo.saveGoal({ horizon: 'short', title: 'Focus on footwork today' });
    const updated = await repo.updateGoal(goal.id, { status: 'done', completedAt: 5 });
    expect(updated).toMatchObject({ status: 'done', completedAt: 5 });
    expect(await repo.updateGoal('nope', { status: 'done' })).toBeNull();
  });

  it('deletes a goal', async () => {
    const repo = new InMemoryRepository();
    const goal = await repo.saveGoal({ horizon: 'long', title: 'Climb 5.13' });
    await repo.deleteGoal(goal.id);
    expect(await repo.getGoal(goal.id)).toBeNull();
    expect(await repo.listGoals()).toHaveLength(0);
  });

  it('saves journals, lists them newest-first by date, updates, and deletes', async () => {
    const repo = new InMemoryRepository();
    const base: NewJournal = { date: 0, activities: ['climbing'] };
    const older = await repo.saveJournal({ ...base, date: 1000 });
    const newer = await repo.saveJournal({
      ...base,
      date: 2000,
      activities: ['climbing', 'fingerboard'],
      summary: 'Felt strong',
    });
    const list = await repo.listJournals();
    expect(list.map((j) => j.id)).toEqual([newer.id, older.id]);
    expect(list[0].activities).toEqual(['climbing', 'fingerboard']);
    expect(list[0].summary).toBe('Felt strong');
    expect(await repo.getJournal(older.id)).toMatchObject({ id: older.id });

    const updated = await repo.updateJournal(older.id, { intensity: 'hard', wins: 'sent it' });
    expect(updated).toMatchObject({ intensity: 'hard', wins: 'sent it' });
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(older.updatedAt);
    expect(await repo.updateJournal('nope', { intensity: 'easy' })).toBeNull();

    await repo.deleteJournal(newer.id);
    expect((await repo.listJournals()).map((j) => j.id)).toEqual([older.id]);
  });

  it('copies journal activities so later input mutation is isolated', async () => {
    const repo = new InMemoryRepository();
    const input: NewJournal = { date: 1, activities: ['climbing'] };
    const saved = await repo.saveJournal(input);
    input.activities.push('strength');
    expect(saved.activities).toEqual(['climbing']);
  });

  it('saves climbs, lists newest-first by date, sets timestamps, and deletes', async () => {
    const repo = new InMemoryRepository();
    const older = await repo.saveClimb({
      date: 1000,
      environment: 'indoor',
      discipline: 'boulder',
      grade: 'V4',
      outcome: 'flash',
    });
    const newer = await repo.saveClimb({
      date: 2000,
      environment: 'outdoor',
      discipline: 'lead',
      grade: '5.11a',
      outcome: 'send',
    });
    expect(older.createdAt).toBeGreaterThan(0);
    expect(older.updatedAt).toBeGreaterThan(0);
    expect((await repo.listClimbs()).map((c) => c.id)).toEqual([newer.id, older.id]);
    await repo.deleteClimb(newer.id);
    expect((await repo.listClimbs()).map((c) => c.id)).toEqual([older.id]);
  });

  it('updates a climb and bumps updatedAt', async () => {
    const repo = new InMemoryRepository();
    const climb = await repo.saveClimb({
      date: 1,
      environment: 'indoor',
      discipline: 'boulder',
      grade: 'V3',
      outcome: 'attempt',
    });
    const before = climb.updatedAt;
    const updated = await repo.updateClimb(climb.id, { grade: 'V4', outcome: 'send' });
    expect(updated).toMatchObject({ grade: 'V4', outcome: 'send' });
    expect(updated!.updatedAt).toBeGreaterThan(before);
    expect(await repo.updateClimb('nope', { grade: 'V5' })).toBeNull();
  });

  it('saves macrocycle periods ordered by start, updates, and deletes', async () => {
    const repo = new InMemoryRepository();
    const b = await repo.saveMacrocyclePeriod({ label: 'Spring', startDate: 200, endDate: 300 });
    const a = await repo.saveMacrocyclePeriod({ label: 'Winter', startDate: 100, endDate: 199 });
    expect((await repo.listMacrocyclePeriods()).map((p) => p.id)).toEqual([a.id, b.id]);
    const updated = await repo.updateMacrocyclePeriod(a.id, { focus: 'Base' });
    expect(updated?.focus).toBe('Base');
    expect(await repo.updateMacrocyclePeriod('nope', { focus: 'x' })).toBeNull();
    await repo.deleteMacrocyclePeriod(b.id);
    expect((await repo.listMacrocyclePeriods()).map((p) => p.id)).toEqual([a.id]);
  });

  it('saves benchmarks, lists them newest-first by date, and deletes', async () => {
    const repo = new InMemoryRepository();
    const a = await repo.saveBenchmark({ testId: 'max-pullups', value: 10, date: 1000 });
    const b = await repo.saveBenchmark({ testId: 'max-pullups', value: 13, date: 2000 });
    expect((await repo.listBenchmarks()).map((x) => x.id)).toEqual([b.id, a.id]);
    await repo.deleteBenchmark(b.id);
    expect((await repo.listBenchmarks()).map((x) => x.id)).toEqual([a.id]);
  });

  it('saves check-ins, lists them newest-first by time, and deletes', async () => {
    const repo = new InMemoryRepository();
    const a = await repo.saveCheckin({ time: 1000, energy: 7, emotion: 3 });
    const b = await repo.saveCheckin({ time: 2000, energy: 2, emotion: -4 });
    expect((await repo.listCheckins()).map((c) => c.id)).toEqual([b.id, a.id]);
    await repo.deleteCheckin(b.id);
    expect((await repo.listCheckins()).map((c) => c.id)).toEqual([a.id]);
  });

  it('returns null profile until saved, then upserts with monotonic updatedAt', async () => {
    const repo = new InMemoryRepository();
    expect(await repo.getProfile()).toBeNull();
    const first = await repo.saveProfile({ abilityTier: 'elite' });
    expect(first.abilityTier).toBe('elite');
    expect(first.aiCoachEnabled).toBe(true); // default preserved
    const second = await repo.saveProfile({ aiCoachEnabled: false });
    expect(second.abilityTier).toBe('elite'); // prior value kept
    expect(second.aiCoachEnabled).toBe(false);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('includes the profile in the snapshot and applies the newer one', async () => {
    const repo = new InMemoryRepository();
    await repo.saveProfile({ reassessWeeks: 6 });
    const snap = await repo.exportSnapshot();
    expect(snap.profile?.reassessWeeks).toBe(6);

    const other = new InMemoryRepository();
    await other.applySnapshot(snap);
    expect((await other.getProfile())?.reassessWeeks).toBe(6);
  });

  it('records and lists usage events newest-first with limit', async () => {
    const repo = new InMemoryRepository();
    await repo.recordEvent({ name: 'app_opened', props: {}, timestamp: 1 });
    await repo.recordEvent({
      name: 'assessment_completed',
      props: { weakestArea: 'mental' },
      timestamp: 2,
    });
    const all = await repo.listEvents();
    expect(all.map((e) => e.name)).toEqual(['assessment_completed', 'app_opened']);
    const limited = await repo.listEvents(1);
    expect(limited).toHaveLength(1);
    expect(limited[0].name).toBe('assessment_completed');
  });

  describe('daily training context', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const context = (date: number, overrides = {}) => ({
      date,
      environment: 'indoor' as const,
      equipment: ['boulder-wall' as const],
      sessionLength: 'standard' as const,
      readiness: 'ok' as const,
      ...overrides,
    });

    it('keeps one row per calendar day, editing rather than duplicating', async () => {
      const repo = new InMemoryRepository();
      const morning = 1000 * DAY + 8 * 60 * 60 * 1000;
      const evening = 1000 * DAY + 20 * 60 * 60 * 1000;
      const first = await repo.saveDailyContext(context(morning));
      const second = await repo.saveDailyContext(context(evening, { readiness: 'tired' }));
      expect(second.id).toBe(first.id);
      expect(second.readiness).toBe('tired');
      expect(await repo.listDailyContexts()).toHaveLength(1);
    });

    it('looks up a context by any time on that day', async () => {
      const repo = new InMemoryRepository();
      await repo.saveDailyContext(context(1000 * DAY + 60_000));
      expect(await repo.getDailyContext(1000 * DAY + 23 * 60 * 60 * 1000)).not.toBeNull();
      expect(await repo.getDailyContext(1001 * DAY)).toBeNull();
    });

    it('round-trips through the snapshot and propagates deletes', async () => {
      const repo = new InMemoryRepository();
      const saved = await repo.saveDailyContext(context(1000 * DAY));
      const snap = await repo.exportSnapshot();
      expect(snap.dailyContexts).toHaveLength(1);

      const other = new InMemoryRepository();
      await other.applySnapshot(snap);
      expect(await other.listDailyContexts()).toHaveLength(1);

      await repo.deleteDailyContext(saved.id);
      const afterDelete = await repo.exportSnapshot();
      expect(afterDelete.dailyContexts).toHaveLength(0);
      expect(afterDelete.tombstones).toContainEqual(
        expect.objectContaining({ table: 'dailyContexts', id: saved.id }),
      );
      await other.applySnapshot(afterDelete);
      expect(await other.listDailyContexts()).toHaveLength(0);
    });
  });

  it('persists the recorded focus on a journal entry', async () => {
    const repo = new InMemoryRepository();
    const saved = await repo.saveJournal({
      date: 1,
      activities: ['climbing'],
      focus: ['maxStrength'],
    });
    expect(saved.focus).toEqual(['maxStrength']);
    const updated = await repo.updateJournal(saved.id, { focus: ['powerEndurance'] });
    expect(updated?.focus).toEqual(['powerEndurance']);
  });
});
