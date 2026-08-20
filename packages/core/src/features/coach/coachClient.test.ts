import type { SyncConfig } from '../sync/syncConfig';
import { CoachUnavailableError, requestCoachSuggestion } from './coachClient';
import type { CoachContext, CoachSuggestion } from './types';

const config: SyncConfig = { url: 'https://coach.example.com/', token: 'secret' };

const context: CoachContext = {
  generatedAt: 1,
  profile: {
    abilityTier: 'intermediate',
    styleFocus: 'all-round',
    daysPerWeek: 3,
    sessionLength: 'standard',
    equipment: ['boulder-wall'],
  },
  today: {
    environment: 'Indoor',
    equipment: ['boulder-wall'],
    sessionLength: 'standard',
    readiness: 'ok',
  },
  schedule: {
    restDay: false,
    suggestedFocus: 'skill',
    allowed: [{ focus: 'skill', label: 'Skill & movement', reason: 'Due', usedThisWeek: 0 }],
    blocked: [],
    trainingDaysThisWeek: 0,
    plannedDaysPerWeek: 3,
    hardDaysInARow: 0,
    recentLoadSummary: 'No training logged in the last few days.',
  },
  recentDays: [],
  assessment: null,
  fitness: [],
  climbing: { sessionsLast30Days: 0, sendRate: 0, hardestSends: [] },
  goals: [],
  journals: [],
  training: { currentStreak: 0, daysLast14: 0 },
  baselinePlan: ['Warm up'],
};

const suggestion: CoachSuggestion = {
  focusArea: 'physical',
  headline: 'Power day',
  plan: ['Warm up', 'Campus board'],
  rationale: 'Your weakest area is physical.',
  watchOuts: ['Mind your fingers'],
};

function mockFetch(impl: typeof fetch) {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = impl;
}

describe('requestCoachSuggestion', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it('POSTs to /coach with the bearer token and context, returning the suggestion', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    mockFetch((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ suggestion }),
      } as Response;
    }) as unknown as typeof fetch);

    const result = await requestCoachSuggestion(config, context);

    expect(result).toEqual(suggestion);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://coach.example.com/coach');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ context });
  });

  it('throws CoachUnavailableError with the status on a non-OK response', async () => {
    mockFetch(
      (async () =>
        ({
          ok: false,
          status: 429,
          json: async () => ({}),
        }) as Response) as unknown as typeof fetch,
    );
    await expect(requestCoachSuggestion(config, context)).rejects.toMatchObject({
      name: 'CoachUnavailableError',
      status: 429,
    });
  });

  it('throws CoachUnavailableError when the network call fails', async () => {
    mockFetch((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    await expect(requestCoachSuggestion(config, context)).rejects.toBeInstanceOf(
      CoachUnavailableError,
    );
  });

  it('rejects a malformed suggestion shape', async () => {
    mockFetch(
      (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ suggestion: { headline: 'oops' } }),
        }) as Response) as unknown as typeof fetch,
    );
    await expect(requestCoachSuggestion(config, context)).rejects.toBeInstanceOf(
      CoachUnavailableError,
    );
  });
});
