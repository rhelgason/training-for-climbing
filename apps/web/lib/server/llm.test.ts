import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachContext } from '@tfc/core';
import { generateCoachSuggestion, isLlmConfigured } from './llm';

const context = {
  generatedAt: 0,
  profile: { abilityTier: 'intermediate' },
  assessment: null,
  fitness: [],
  climbing: { sessionsLast30Days: 0, sendRate: 0, hardestSends: [] },
  goals: [],
  journals: [],
  training: { currentStreak: 0, daysLast14: 0 },
} satisfies CoachContext;

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
});
