import type {
  AssessmentRecord,
  BenchmarkRecord,
  ClimbRecord,
  GoalRecord,
  JournalEntry,
  ProfileRecord,
} from '../../db/types';
import { buildCoachContext, type CoachContextInput } from './context';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function assessment(over: Partial<AssessmentRecord> = {}): AssessmentRecord {
  return {
    id: over.id ?? 'a',
    createdAt: over.createdAt ?? NOW - 5 * DAY,
    responses: over.responses ?? {},
    mental: over.mental ?? 40,
    technical: over.technical ?? 30,
    physical: over.physical ?? 50,
    weakestArea: over.weakestArea ?? 'technical',
  };
}

function journal(dayOffset: number, over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: `j${dayOffset}`,
    createdAt: NOW + dayOffset * DAY,
    updatedAt: NOW + dayOffset * DAY,
    date: NOW + dayOffset * DAY,
    activities: over.activities ?? ['climbing'],
    summary: over.summary,
    intensity: over.intensity,
    wins: over.wins,
    struggles: over.struggles,
    focus: over.focus,
  };
}

function climb(dayOffset: number, over: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: `c${dayOffset}`,
    createdAt: NOW + dayOffset * DAY,
    updatedAt: NOW + dayOffset * DAY,
    date: NOW + dayOffset * DAY,
    environment: 'indoor',
    discipline: over.discipline ?? 'boulder',
    grade: over.grade ?? 'V3',
    outcome: over.outcome ?? 'send',
  };
}

function input(over: Partial<CoachContextInput> = {}): CoachContextInput {
  return {
    profile: null,
    assessments: [],
    benchmarks: [],
    climbs: [],
    goals: [],
    journals: [],
    nowMs: NOW,
    ...over,
  };
}

describe('buildCoachContext', () => {
  it('uses profile defaults when no profile is set', () => {
    const ctx = buildCoachContext(input());
    expect(ctx.profile.abilityTier).toBe('intermediate');
    expect(ctx.assessment).toBeNull();
    expect(ctx.generatedAt).toBe(NOW);
  });

  it('includes the weakest area’s flagged weak-spot statements', () => {
    // Questions 2 and 5 are technical; rate them at/below the weakness threshold.
    const ctx = buildCoachContext(
      input({
        assessments: [assessment({ responses: { 2: 1, 5: 2 }, weakestArea: 'technical' })],
      }),
    );
    expect(ctx.assessment?.weakSpots.length).toBe(2);
    expect(typeof ctx.assessment?.weakSpots[0]).toBe('string');
  });

  it('picks the latest assessment and reflects the weakest area', () => {
    const ctx = buildCoachContext(
      input({
        assessments: [
          assessment({ id: 'old', createdAt: NOW - 30 * DAY, weakestArea: 'physical' }),
          assessment({ id: 'new', createdAt: NOW - 2 * DAY, weakestArea: 'mental' }),
        ],
      }),
    );
    expect(ctx.assessment?.weakestArea).toBe('mental');
  });

  it('summarises climbing: hardest send, send rate, recent volume', () => {
    const ctx = buildCoachContext(
      input({
        climbs: [
          climb(-1, { grade: 'V5', outcome: 'send' }),
          climb(-2, { grade: 'V3', outcome: 'attempt' }),
          climb(-3, { grade: 'V4', outcome: 'flash' }),
        ],
      }),
    );
    expect(ctx.climbing.sessionsLast30Days).toBe(3);
    expect(ctx.climbing.sendRate).toBeCloseTo(2 / 3);
    expect(ctx.climbing.hardestSends).toContainEqual({ discipline: 'Boulder', grade: 'V5' });
  });

  it('includes at most 10 journals, newest first, with free text', () => {
    const journals = Array.from({ length: 12 }, (_, i) => journal(-i, { summary: `day ${i}` }));
    const ctx = buildCoachContext(input({ journals }));
    expect(ctx.journals).toHaveLength(10);
    expect(ctx.journals[0].summary).toBe('day 0'); // most recent
  });

  it('computes streak and recent training days from journals + climbs', () => {
    const ctx = buildCoachContext(
      input({
        journals: [journal(0), journal(-1)],
        climbs: [climb(-2)],
      }),
    );
    expect(ctx.training.currentStreak).toBe(3);
    expect(ctx.training.daysLast14).toBe(3);
  });

  it('reports fitness benchmark highlights with a trend', () => {
    const bench = (value: number, dayOffset: number): BenchmarkRecord => ({
      id: `b${value}`,
      createdAt: NOW + dayOffset * DAY,
      testId: 'max-pullups',
      value,
      date: NOW + dayOffset * DAY,
    });
    const ctx = buildCoachContext(input({ benchmarks: [bench(10, -10), bench(13, -1)] }));
    expect(ctx.fitness).toHaveLength(1);
    expect(ctx.fitness[0]).toMatchObject({ latest: 13, trend: 'up' });
  });

  it('limits goals to active short/medium/long, up to five', () => {
    const goals: GoalRecord[] = Array.from({ length: 7 }, (_, i) => ({
      id: `g${i}`,
      createdAt: i,
      updatedAt: i,
      horizon: 'medium',
      title: `Goal ${i}`,
      status: 'active',
    }));
    const ctx = buildCoachContext(input({ goals }));
    expect(ctx.goals.length).toBeLessThanOrEqual(5);
  });

  it('respects the configured ability tier from the profile', () => {
    const profile: ProfileRecord = {
      id: 'profile',
      createdAt: 0,
      updatedAt: 0,
      abilityTier: 'elite',
      defaultDiscipline: 'lead',
      gradeSystem: 'yds-v',
      reassessWeeks: 8,
      aiCoachEnabled: true,
      styleFocus: 'boulder-power',
      equipment: ['boulder-wall', 'hangboard'],
      daysPerWeek: 4,
      sessionLength: 'standard',
    };
    const ctx = buildCoachContext(input({ profile }));
    expect(ctx.profile.abilityTier).toBe('elite');
  });

  describe('what the model is told about recent training', () => {
    it('spells out the last sessions with how many days ago they were', () => {
      const ctx = buildCoachContext(
        input({
          journals: [
            journal(-1, {
              focus: ['maxStrength'],
              intensity: 'hard',
              summary: 'Max hangs, felt strong',
              struggles: 'Right elbow grumbling',
            }),
            journal(-3, { activities: ['climbing'], intensity: 'easy' }),
          ],
        }),
      );
      const yesterday = ctx.recentDays[0];
      expect(yesterday.daysAgo).toBe(1);
      expect(yesterday.focus).toContain('Max strength');
      expect(yesterday.struggles).toBe('Right elbow grumbling');
      expect(ctx.schedule.recentLoadSummary).toContain('Yesterday');
    });

    it('includes climbs logged on a recent day', () => {
      const ctx = buildCoachContext(
        input({ climbs: [climb(-2, { grade: 'V6', outcome: 'flash' })] }),
      );
      expect(ctx.recentDays[0].climbs).toEqual(['V6 flash']);
    });
  });

  describe('the binding schedule', () => {
    it('blocks max strength the day after a max-strength session, with a reason', () => {
      const ctx = buildCoachContext(
        input({ journals: [journal(-1, { focus: ['maxStrength'], intensity: 'hard' })] }),
      );
      const blocked = ctx.schedule.blocked.find((b) => b.focus === 'maxStrength');
      expect(blocked?.reason).toContain('48 hours');
      expect(ctx.schedule.allowed.map((a) => a.focus)).not.toContain('maxStrength');
    });

    it('reports a rest day so the model cannot prescribe training through it', () => {
      const ctx = buildCoachContext(
        input({
          journals: [
            journal(0, { focus: ['power'], intensity: 'hard' }),
            journal(-1, { focus: ['maxStrength'], intensity: 'hard' }),
            journal(-2, { focus: ['powerEndurance'], intensity: 'hard' }),
          ],
        }),
      );
      expect(ctx.schedule.restDay).toBe(true);
      expect(ctx.schedule.allowed).toEqual([]);
      expect(ctx.schedule.hardDaysInARow).toBe(3);
    });

    it('carries the deterministic plan as a floor for the model to beat', () => {
      const ctx = buildCoachContext(input());
      expect(ctx.baselinePlan.length).toBeGreaterThan(0);
    });
  });

  describe("today's check-in", () => {
    it("uses today's equipment over the profile's usual setup", () => {
      const ctx = buildCoachContext(
        input({
          dailyContext: {
            id: 'dc',
            createdAt: NOW,
            updatedAt: NOW,
            date: NOW,
            environment: 'outdoor',
            equipment: ['outdoor-rock'],
            sessionLength: 'long',
            readiness: 'tired',
            note: 'At the crag, no gear',
          },
        }),
      );
      expect(ctx.today.equipment).toEqual(['outdoor-rock']);
      expect(ctx.today.environment).toBe('Outdoor');
      expect(ctx.today.readiness).toBe('tired');
      expect(ctx.today.note).toBe('At the crag, no gear');
      // Tired rules out near-limit work whatever the week's quota says.
      expect(ctx.schedule.blocked.map((b) => b.focus)).toContain('maxStrength');
    });

    it('falls back to the profile when no check-in was filled in', () => {
      const ctx = buildCoachContext(input());
      expect(ctx.today.readiness).toBe('ok');
      expect(ctx.today.environment).toBe('Indoor');
    });
  });

  it("passes the climber's own words through untouched", () => {
    const ctx = buildCoachContext(
      input({
        profile: {
          id: 'profile',
          createdAt: 0,
          updatedAt: 0,
          abilityTier: 'intermediate',
          defaultDiscipline: 'boulder',
          gradeSystem: 'yds-v',
          reassessWeeks: 8,
          aiCoachEnabled: true,
          styleFocus: 'sport-endurance',
          equipment: ['rope-wall'],
          daysPerWeek: 4,
          sessionLength: 'standard',
          climberContext: 'Coming back from a pulley strain, sport climbing outdoors in spring.',
        },
      }),
    );
    expect(ctx.profile.climberContext).toMatch(/pulley strain/);
    expect(ctx.profile.styleFocus).toBe('sport-endurance');
  });
});
