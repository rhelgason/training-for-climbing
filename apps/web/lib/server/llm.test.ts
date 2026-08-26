import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachContext, CoachSuggestion } from '@tfc/core';
import { assertRespectsPrescriptions, generateCoachSuggestion, isLlmConfigured } from './llm';

function makeContext(restDay = false) {
  return {
    generatedAt: 0,
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
      restDay,
      suggestedFocus: restDay ? null : 'skill',
      allowed: restDay
        ? []
        : [{ focus: 'skill', label: 'Skill & movement', reason: 'Due', usedThisWeek: 0 }],
      blocked: [],
      trainingDaysThisWeek: 0,
      plannedDaysPerWeek: 3,
      hardDaysInARow: restDay ? 3 : 0,
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
    prescriptions: { climbing: null, protocols: [] },
  } satisfies CoachContext;
}

const context = makeContext();

/** A well-formed model reply, in the provider's envelope. */
function geminiReply(payload: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as Response;
}

beforeEach(() => {
  delete process.env.LLM_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.LLM_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isLlmConfigured', () => {
  it('checks the key belonging to the selected provider', () => {
    expect(isLlmConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'k';
    expect(isLlmConfigured()).toBe(true);

    // Switching provider without its key means the coach is off again.
    process.env.LLM_PROVIDER = 'groq';
    expect(isLlmConfigured()).toBe(false);

    process.env.GROQ_API_KEY = 'k';
    expect(isLlmConfigured()).toBe(true);
  });
});

describe('generateCoachSuggestion', () => {
  it('returns the structured suggestion from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      geminiReply({
        focusArea: 'physical',
        headline: 'Power day',
        plan: ['Warm up', 'Max hangs'],
        rationale: 'Physical is your weakest area.',
        watchOuts: ['Stop if your fingers ache'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);

    expect(suggestion).toEqual({
      focusArea: 'physical',
      headline: 'Power day',
      plan: ['Warm up', 'Max hangs'],
      rationale: 'Physical is your weakest area.',
      watchOuts: ['Stop if your fingers ache'],
    });
    // The key belongs in the URL, and the default model should be used.
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=test-key');
  });

  it('fills in defaults when the model omits fields', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply({ headline: '' })));

    const suggestion = await generateCoachSuggestion(context);

    expect(suggestion).toEqual({
      focusArea: null,
      headline: 'Train smart today',
      plan: [],
      rationale: '',
      watchOuts: [],
    });
  });

  it('honours the LLM_MODEL override', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'gemini-3-experimental';
    const fetchMock = vi.fn().mockResolvedValue(geminiReply({ headline: 'x' }));
    vi.stubGlobal('fetch', fetchMock);

    await generateCoachSuggestion(context);

    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3-experimental');
  });

  it('throws when the provider errors, so the route can return 502', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      } as Response),
    );

    await expect(generateCoachSuggestion(context)).rejects.toThrow(/429/);
  });

  it('throws when the reply has no content', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) } as Response),
    );

    await expect(generateCoachSuggestion(context)).rejects.toThrow(/no content/);
  });

  it('calls Groq when selected', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ headline: 'Endurance day' }) } }],
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);

    expect(suggestion.headline).toBe('Endurance day');
    expect(fetchMock.mock.calls[0][0]).toContain('api.groq.com');
  });

  it('rejects a plan that trains through a scheduled rest day', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Light power endurance',
          plan: ['Warm up', 'A few easy laps'],
          restDay: false,
        }),
      ),
    );

    // The route turns this into a 502 and the client shows the deterministic
    // rest-day plan, which is the correct advice.
    await expect(generateCoachSuggestion(makeContext(true))).rejects.toThrow(/rest day/);
  });

  it('accepts a rest-day plan that agrees with the scheduler', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Rest today',
          plan: ['Sleep, eat, hydrate'],
          restDay: true,
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(makeContext(true));
    expect(suggestion.headline).toBe('Rest today');
    // The validation channel is stripped before the client sees it.
    expect(suggestion).not.toHaveProperty('restDay');
  });
});

describe('assertRespectsPrescriptions', () => {
  const withProtocol = (targetLabel: string | null): CoachContext =>
    ({
      prescriptions: {
        climbing: null,
        protocols: [
          {
            name: 'Max-weight hangs',
            text: 'Max-weight hangs — +35 lb · 5 sets · 10 s hang · 3 min rest',
            targetLabel,
            because: '90% of +40 lb',
          },
        ],
      },
    }) as unknown as CoachContext;

  const plan = (steps: string[]): CoachSuggestion => ({
    focusArea: null,
    headline: 'h',
    plan: steps,
    rationale: 'r',
    watchOuts: [],
  });

  it('accepts a plan that carries the prescribed number through', () => {
    expect(() =>
      assertRespectsPrescriptions(
        plan(['Warm up', 'Max-weight hangs — +35 lb · 5 sets · 10 s hang · 3 min rest']),
        withProtocol('+35 lb'),
      ),
    ).not.toThrow();
  });

  it('rejects a plan that changes the prescribed load', () => {
    // The tempting failure: rounding up, or adding a little for "progression".
    expect(() =>
      assertRespectsPrescriptions(
        plan(['Max-weight hangs — +40 lb, 5 sets']),
        withProtocol('+35 lb'),
      ),
    ).toThrow(/changed the prescribed load/i);
  });

  it('accepts a plan that leaves the exercise out entirely', () => {
    // Not prescribing it is a coaching call; renaming its load is not.
    expect(() =>
      assertRespectsPrescriptions(plan(['Long ARC session', 'Core']), withProtocol('+35 lb')),
    ).not.toThrow();
  });

  it('ignores protocols that have no number yet', () => {
    // A test day has nothing to contradict.
    expect(() =>
      assertRespectsPrescriptions(
        plan(['Max-weight hangs — find your max today']),
        withProtocol(null),
      ),
    ).not.toThrow();
  });

  it('is case-insensitive about how the model writes it', () => {
    expect(() =>
      assertRespectsPrescriptions(plan(['MAX-WEIGHT HANGS at +35 LB']), withProtocol('+35 lb')),
    ).not.toThrow();
  });

  it('does nothing when there are no prescriptions at all', () => {
    expect(() =>
      assertRespectsPrescriptions(plan(['Anything']), {
        prescriptions: undefined,
      } as unknown as CoachContext),
    ).not.toThrow();
  });
});
