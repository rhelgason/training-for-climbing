import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachContext, CoachSuggestion } from '@tfc/core';
import {
  assertRespectsPrescriptions,
  currentLlmModel,
  fallbackLlmModel,
  generateCoachRun,
  generateCoachSuggestion,
  isLlmConfigured,
  llmChain,
} from './llm';
import { llmRetry } from './llmRetry';

function makeContext(restDay = false): CoachContext {
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
    macrocycle: { current: null, upcoming: null, periods: [] },
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
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.MISTRAL_API_KEY;
  delete process.env.XAI_API_KEY;
  delete process.env.LLM_MODEL;
  vi.spyOn(llmRetry, 'sleepMs').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('currentLlmModel', () => {
  it('is Gemini 3.6 Flash even when LLM_MODEL is a retired id', () => {
    expect(currentLlmModel()).toBe('gemini-3.6-flash');
    process.env.LLM_MODEL = 'gemini-2.5-flash';
    expect(currentLlmModel()).toBe('gemini-3.6-flash');
    process.env.LLM_MODEL = 'models/gemini-2.5-flash';
    expect(currentLlmModel()).toBe('gemini-3.6-flash');
  });

  it('uses GPT-OSS 120B for Groq and ignores retired or Gemini ids', () => {
    process.env.LLM_PROVIDER = 'groq';
    expect(currentLlmModel()).toBe('openai/gpt-oss-120b');
    process.env.LLM_MODEL = 'llama-3.3-70b-versatile';
    expect(currentLlmModel()).toBe('openai/gpt-oss-120b');
    process.env.LLM_MODEL = 'gemini-2.5-flash';
    expect(currentLlmModel()).toBe('openai/gpt-oss-120b');
    process.env.LLM_MODEL = 'openai/gpt-oss-20b';
    expect(currentLlmModel()).toBe('openai/gpt-oss-20b');
  });
});

describe('llmChain', () => {
  it('lists every configured provider and skips a half-set Cloudflare pair', () => {
    expect(llmChain()).toEqual([]);
    expect(fallbackLlmModel()).toBeNull();

    process.env.GEMINI_API_KEY = 'g';
    process.env.GROQ_API_KEY = 'q';
    process.env.OPENROUTER_API_KEY = 'o';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    expect(llmChain()).toEqual([
      'gemini-3.6-flash',
      'openai/gpt-oss-120b',
      'google/gemma-4-31b-it:free',
    ]);

    process.env.CLOUDFLARE_API_TOKEN = 'cf';
    process.env.XAI_API_KEY = 'x';
    expect(llmChain()).toEqual([
      'gemini-3.6-flash',
      'openai/gpt-oss-120b',
      'google/gemma-4-31b-it:free',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      'grok-4.7',
    ]);
    expect(fallbackLlmModel()).toBe('openai/gpt-oss-120b');
  });
});

describe('isLlmConfigured', () => {
  it('is on when either provider key is set', () => {
    expect(isLlmConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'k';
    expect(isLlmConfigured()).toBe(true);

    // Preferring Groq without its key does not turn the coach off while
    // Gemini can still answer.
    process.env.LLM_PROVIDER = 'groq';
    expect(isLlmConfigured()).toBe(true);

    delete process.env.GEMINI_API_KEY;
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
      injuries: [],
    });
    // The key belongs in the URL, and the default model should be used.
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('gemini-3.6-flash');
    expect(url).toContain('key=test-key');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
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
      injuries: [],
    });
  });

  it('passes through injuries the model read in the journal', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Rest — injury first',
          plan: ['No climbing'],
          rationale: 'MRI pending.',
          watchOuts: [],
          restDay: false,
          injuries: [
            {
              note: 'Severe leg injury, MRI pending.',
              evidence: 'planning to get an MRI',
              bodyPart: 'leg',
              noClimbing: true,
            },
          ],
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.injuries).toEqual([
      {
        note: 'Severe leg injury, MRI pending.',
        evidence: 'planning to get an MRI',
        bodyPart: 'leg',
        noClimbing: true,
      },
    ]);
    // The injury note can survive. It does not get to turn the day into rest
    // when the scheduler said train — including by writing "no climbing".
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Training day');
    expect(suggestion.plan).toEqual(['Warm up']);
  });

  it('never sends a retired Gemini id from LLM_MODEL', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'gemini-2.5-flash';
    const fetchMock = vi.fn().mockResolvedValue(geminiReply({ headline: 'x' }));
    vi.stubGlobal('fetch', fetchMock);

    await generateCoachSuggestion(context);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('gemini-3.6-flash');
    expect(url).not.toContain('gemini-2.5-flash');
  });

  it('throws when the provider errors, so the route can return 502', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'no such model',
      } as Response),
    );

    await expect(generateCoachSuggestion(context)).rejects.toThrow(/404/);
  });

  it('retries a 503 spike and succeeds if Gemini recovers', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'high demand',
      } as Response)
      .mockResolvedValueOnce(geminiReply({ headline: 'Recovered' }));
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.headline).toBe('Recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(llmRetry.sleepMs).toHaveBeenCalled();
  });

  it('gives up after retrying a persistent 503', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'high demand',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateCoachSuggestion(context)).rejects.toThrow(/503/);
    // One retry on the last provider, then stop. A second model id is for a
    // 404, not a capacity error.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the reply has no content', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) } as Response),
    );

    await expect(generateCoachSuggestion(context)).rejects.toThrow(/no content/);
  });

  function httpError(status: number, body: string) {
    return { ok: false, status, text: async () => body } as Response;
  }

  function groqReply(payload: unknown) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      }),
    } as Response;
  }

  it('calls Groq once when Gemini returns a usage limit, without retrying Gemini', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(429, 'You exceeded your current quota. RESOURCE_EXHAUSTED'))
      .mockResolvedValueOnce(groqReply({ headline: 'From Groq' }));
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);

    expect(suggestion.headline).toBe('From Groq');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.groq.com');
    const groqBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(groqBody.model).toBe('openai/gpt-oss-120b');
    expect(groqBody.reasoning_effort).toBe('low');
    expect(groqBody.include_reasoning).toBe(false);
    expect(llmRetry.sleepMs).not.toHaveBeenCalled();
  });

  it('tries the other Groq model when the first id does not exist', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(503, 'high demand'))
      .mockResolvedValueOnce(
        httpError(404, 'The model `openai/gpt-oss-120b` does not exist or you do not have access'),
      )
      .mockResolvedValueOnce(groqReply({ headline: 'From the other Groq model' }));
    vi.stubGlobal('fetch', fetchMock);

    const run = await generateCoachRun(context);

    expect(run.provider).toBe('groq');
    expect(run.model).toBe('openai/gpt-oss-20b');
    expect(run.suggestion.headline).toBe('From the other Groq model');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstGroq = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const secondGroq = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(firstGroq.model).toBe('openai/gpt-oss-120b');
    expect(secondGroq.model).toBe('openai/gpt-oss-20b');
    expect(llmRetry.sleepMs).not.toHaveBeenCalled();
  });

  it('falls back to Groq on a Gemini capacity error without burning the retry budget', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(503, 'high demand'))
      .mockResolvedValueOnce(groqReply({ headline: 'From Groq' }));
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);

    expect(suggestion.headline).toBe('From Groq');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('api.groq.com');
  });

  it('tries the other Gemini model on a 404, then Groq', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(404, 'no such model'))
      .mockResolvedValueOnce(httpError(404, 'no such model'))
      .mockResolvedValueOnce(groqReply({ headline: 'From Groq after a dead Gemini id' }));
    vi.stubGlobal('fetch', fetchMock);

    const run = await generateCoachRun(context);

    expect(run.provider).toBe('groq');
    expect(run.model).toBe('openai/gpt-oss-120b');
    expect(run.suggestion.headline).toBe('From Groq after a dead Gemini id');
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.6-flash');
    expect(fetchMock.mock.calls[1][0]).toContain('gemini-3.5-flash');
    expect(fetchMock.mock.calls[2][0]).toContain('api.groq.com');
  });

  it('tries Groq when Gemini returns no answer', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [] } }] }),
      } as Response)
      .mockResolvedValueOnce(groqReply({ headline: 'From Groq after an empty Gemini' }));
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.headline).toBe('From Groq after an empty Gemini');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('api.groq.com');
  });

  it('reads the JSON part and ignores a Gemini thought', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'planning the session' },
                  { text: JSON.stringify({ headline: 'Power day', plan: ['Warm up'] }) },
                ],
              },
            },
          ],
        }),
      } as Response),
    );

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.headline).toBe('Power day');
    expect(suggestion.plan).toEqual(['Warm up']);
  });

  it('accepts a fenced JSON answer from a backup provider', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{"headline":"Endurance day","plan":["ARC"]}\n```',
              },
            },
          ],
        }),
      } as Response),
    );

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.headline).toBe('Endurance day');
    expect(suggestion.plan).toEqual(['ARC']);
  });

  it('asks OpenRouter for a free model and refuses a paid route', async () => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ headline: 'From OpenRouter' }) } }],
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(context);
    expect(suggestion.headline).toBe('From OpenRouter');
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe('google/gemma-4-31b-it:free');
    expect(body.models[0]).toBe('google/gemma-4-31b-it:free');
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer or-key');
  });

  it('tries the next provider when the model trains through a scheduled rest', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        geminiReply({ headline: 'Light laps', plan: ['Climb easy'], restDay: false }),
      )
      .mockResolvedValueOnce(groqReply({ headline: 'Rest today', plan: ['Sleep'], restDay: true }));
    vi.stubGlobal('fetch', fetchMock);

    const suggestion = await generateCoachSuggestion(makeContext(true));
    expect(suggestion.headline).toBe('Rest today');
    expect(suggestion.restDay).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports both providers when the fallback also fails', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(429, 'quota'))
      .mockResolvedValueOnce(httpError(429, 'rate limit'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateCoachSuggestion(context)).rejects.toThrow(
      /Gemini error 429[\s\S]*Groq error 429/,
    );
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
    expect(suggestion.restDay).toBe(true);
  });

  it('drops a rest day the scheduler did not call and no injury requires', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Rest today',
          plan: ['Full rest', 'No climbing'],
          rationale: 'You said you were resting tomorrow.',
          restDay: true,
          injuries: [],
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(makeContext(false));
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Training day');
    expect(suggestion.plan).toEqual(['Warm up']);
  });

  it('drops a rest day the model hid behind an injury it invented', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Rest — protect the fingers',
          plan: ['No climbing', 'Light mobility'],
          rationale: 'You said you were resting.',
          restDay: true,
          injuries: [
            {
              note: 'Fingers need a day off.',
              evidence: 'fully resting',
              bodyPart: 'finger',
              noClimbing: true,
            },
          ],
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(makeContext(false));
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Training day');
    expect(suggestion.plan).toEqual(['Warm up']);
  });

  it('replaces a rest day written in other words when the scheduler said train', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Active recovery',
          plan: ['Take it easy', 'Mobility only', 'No climbing'],
          rationale: 'You have done enough this week.',
          restDay: false,
          injuries: [],
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(makeContext(false));
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Training day');
    expect(suggestion.plan).toEqual(['Warm up']);
  });

  it('replaces climbing or a day off when the hands are due off the wall', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'One more hangboard session',
          plan: ['Hangboard repeaters', 'Limit boulders'],
          rationale: 'You can squeeze in one more.',
          restDay: false,
        }),
      ),
    );

    const ctx = makeContext(false);
    ctx.schedule.offFingers = true;
    ctx.schedule.fingerDaysInARow = 3;
    ctx.baselinePlan = ['Reverse wrist curls', 'Easy run', 'Stretch'];
    const suggestion = await generateCoachSuggestion(ctx);
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Off the fingers');
    expect(suggestion.plan).toEqual(['Reverse wrist curls', 'Easy run', 'Stretch']);
  });

  it('keeps lifting, cardio, and stretching on an off-finger day', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Off the fingers',
          plan: ['Reverse wrist curls', '20 min easy run', 'Stretch the hips'],
          rationale: 'Hands have been on holds three days running.',
          restDay: false,
        }),
      ),
    );

    const ctx = makeContext(false);
    ctx.schedule.offFingers = true;
    ctx.baselinePlan = ['Built-in lifting'];
    const suggestion = await generateCoachSuggestion(ctx);
    expect(suggestion.restDay).toBe(false);
    expect(suggestion.headline).toBe('Off the fingers');
    expect(suggestion.plan).toEqual(['Reverse wrist curls', '20 min easy run', 'Stretch the hips']);
  });

  it('keeps a training plan that only mentions rest between efforts', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply({
          headline: 'Power day',
          plan: ['Warm up on easy boulders', 'Limit boulders, 3 min rest between tries'],
          rationale: 'Power is allowed today.',
          restDay: false,
          injuries: [],
        }),
      ),
    );

    const suggestion = await generateCoachSuggestion(makeContext(false));
    expect(suggestion.headline).toBe('Power day');
    expect(suggestion.plan).toEqual([
      'Warm up on easy boulders',
      'Limit boulders, 3 min rest between tries',
    ]);
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
