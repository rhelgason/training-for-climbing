/**
 * Provider-agnostic LLM adapter for the AI Coach.
 *
 * Ported verbatim in behaviour from the standalone Express server
 * (`server/llm.js`) when the backend moved into Next route handlers.
 *
 * Default provider is Google **Gemini 3.6 Flash**. Groq (GPT-OSS 120B) is the
 * fallback when Gemini answers with a usage limit or a capacity error, as long
 * as `GROQ_API_KEY` is set. The phone never chooses. Both are called over plain
 * REST so the app needs no extra npm dependency.
 *
 * `llama-3.3-70b-versatile` was shut off for developer keys on 2026-08-16.
 * A Groq 404 for a missing model tries the other GPT-OSS id before giving up.
 *
 * Env:
 *   LLM_PROVIDER     – 'gemini' (default) | 'groq'. Which one is tried first.
 *   GEMINI_API_KEY   – free key from https://aistudio.google.com/apikey
 *   GROQ_API_KEY     – free key from https://console.groq.com/keys
 *   LLM_MODEL        – Groq override only. Gemini always uses gemini-3.6-flash.
 *                      Retired Groq ids and leftover Gemini ids are ignored.
 */
import type { CoachContext, CoachInjuryFinding, CoachSuggestion } from '@tfc/core';
import { TRAINING_REFERENCE } from './coachKnowledge';
import { fetchWithLlmRetries, isUsageLimit, LlmHttpError } from './llmRetry';

type ProviderId = 'gemini' | 'groq';

const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'openai/gpt-oss-120b',
};

/** Developer-tier ids Groq has shut off. A leftover LLM_MODEL must not 404. */
const RETIRED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'llama-3.1-70b-specdec',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'qwen/qwen3-32b',
  'qwen/qwen3.6-27b',
]);

/** Tried, in order, when the chosen Groq id itself 404s. */
const GROQ_MODEL_FALLBACKS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

function preferredProvider(): ProviderId {
  return (process.env.LLM_PROVIDER || 'gemini').toLowerCase() === 'groq' ? 'groq' : 'gemini';
}

function modelFor(id: ProviderId): string {
  if (id === 'groq') {
    const requested = (process.env.LLM_MODEL || '').trim();
    // Gemini ignores LLM_MODEL, and Groq must ignore it too when the value is
    // a Gemini id or a model Groq has retired. Next inlines process.env.LLM_MODEL
    // at build time, so a leftover gemini-2.5-flash or llama-3.3-70b-versatile
    // is how the 404 keeps coming back.
    const unusable =
      !requested ||
      /^models\/gemini|^gemini/i.test(requested) ||
      RETIRED_GROQ_MODELS.has(requested);
    return unusable ? DEFAULT_MODELS.groq : requested;
  }
  return DEFAULT_MODELS.gemini;
}

function groqModelChain(): string[] {
  const primary = modelFor('groq');
  return [primary, ...GROQ_MODEL_FALLBACKS.filter((id) => id !== primary)];
}

/**
 * Providers that can actually be called, preferred first. A key that is not
 * set is skipped, so Gemini-as-default still falls through to Groq when only
 * the Groq key is present, and the reverse.
 */
export function providerChain(): ProviderId[] {
  const have: ProviderId[] = [];
  if (process.env.GEMINI_API_KEY) have.push('gemini');
  if (process.env.GROQ_API_KEY) have.push('groq');
  const preferred = preferredProvider();
  const primary = have.includes(preferred) ? preferred : have[0];
  if (!primary) return [];
  return [primary, ...have.filter((id) => id !== primary)];
}

/**
 * Model id of the provider that will be tried first.
 *
 * Gemini ignores `LLM_MODEL`. See `modelFor`.
 */
export function currentLlmModel(): string {
  const [primary] = providerChain();
  return modelFor(primary ?? preferredProvider());
}

/** Model id of the next provider, or null when there is nowhere to fall back. */
export function fallbackLlmModel(): string | null {
  const chain = providerChain();
  return chain.length > 1 ? modelFor(chain[1]) : null;
}

/** The static coaching brief sent on every call. */
const SYSTEM_PROMPT = `You are an expert climbing coach writing one climber's session for today.
You are given a structured context: their self-assessment of the performance triad (mental,
technical, physical), fitness benchmarks, recent climbs, goals, a daily journal, what they have
available today, and — most importantly — \`schedule\`, the result of a training-load calculation
already performed for you. Give advice in your own voice; do not cite books, authors, or
external sources.

HARD CONSTRAINTS. These are computed from the climber's actual logged history and are not
suggestions. Violating one produces a plan that will injure or overtrain them:
- How their body feels is \`journals\` (newest first, at most the last 10) and \`today.note\`.
  There is no injury list. Do not rest or deload because of \`profile.climberContext\` or any
  note saved on an earlier day. If it is not in the newest entries, it has settled.
- Weight the newest entries over the older ones in that list. If a problem shows up in an
  older entry and the later ones do not mention it, or they say it is healing, getting better,
  pain-free, or they trained on it, do not set \`restDay\` for it, do not avoid loading it,
  and do not include it in \`injuries\`. Ordinary pump and next-day soreness are not injuries.
- Set \`restDay\` true for a physical problem only when a newest entry or today's note still
  describes something unresolved (a fresh tear, MRI, "can't climb", a body part that still
  hurts in a way that is more than ordinary pump) and they should not load that tissue today.
  Report only that current problem in \`injuries\`. Otherwise \`injuries\` is [].
- \`schedule.injury\` is a keyword backup over those same recent entries, not a record that
  outlives them. If it is set, honour it. If \`noClimbing\` is true, prescribe REST / rehab
  only — no performance climbing, hangboard, campus, or limit boulders. If \`noHighIntensity\`
  is true, do not prescribe max strength, power, or power-endurance. If it is null, do not
  invent a rest day from an older story.
- If \`schedule.restDay\` is true, prescribe a REST day. Do not find a workout that "still
  counts". Say why, using \`schedule.restReason\`, and give recovery guidance only.
  You MAY also rest when the scheduler did not, but only for a problem that is still
  unresolved in the newest entries, as above. Do not set \`restDay\` for any other reason.
- \`schedule.fulfilledRests\` are rests they already announced. "Tomorrow" and "today"
  inside a journal are relative to that entry's \`daysAgo\`, not to now. An entry with
  \`daysAgo: 2\` that says "I'm fully resting tomorrow" is about yesterday. If that day
  is in \`fulfilledRests\` with \`taken: true\`, or \`recentDays\` shows it as Rest with
  no session logged, the rest already happened. Do not set \`restDay\`, and do not
  write a rest plan, to honour it again.
- Prescribe ONLY focuses listed in \`schedule.allowed\`. Never prescribe anything in
  \`schedule.blocked\` — each carries the reason it is out (too soon since the last one, weekly
  ceiling reached, equipment missing, injury, or they reported feeling beaten up).
- Use ONLY equipment listed in \`today.equipment\`. If there is no hangboard today, do not
  prescribe hangboard work, however much you would like to.
- Fit the session to \`today.sessionLength\`.
- \`prescriptions.protocols\` holds loads already computed from this climber's measured
  baselines, bounded by safety rules you cannot see — never above what they have actually
  lifted or hung, rounded down, and reduced when the measurement is old or unconfirmed.
  Do NOT invent, adjust, or "progress" these numbers. If you prescribe that exercise, copy
  its \`text\` verbatim as one of your steps. Where \`targetLabel\` is null the app has no
  baseline yet and the line prescribes a test — keep it as a test; do not guess a weight to
  replace it. Two different numbers reaching the climber from one screen is worse than either.
- \`prescriptions.climbing\` gives the grades to pitch today's climbing at, derived from their
  own send pyramid. Use those grades; do not substitute your own estimate of their level.

START FROM RECENT HISTORY. \`recentDays\` is ordered newest first with \`daysAgo\` on each entry;
\`daysAgo: 1\` is yesterday. A day with no session logged is included as Rest — that silence
is a rest day already taken, not a missing day. Before choosing anything, read the last three
days: what they trained, how hard it was, and what their free text says about how their body
felt. Today's session must make sense as the *next* one after those, including a rest they
already took. State the connection explicitly in your rationale — "your fingers took a hard
max-hang session yesterday, so today is…". If they
mentioned soreness, a tweak, or fatigue in a recent entry, respond to it by name. Their free
text is the highest-signal thing you have: grades attempted, where they pumped out, what felt
off. Use the specifics rather than restating them. \`skipped\` lists steps they were prescribed
but didn't get to — if the same block keeps getting dropped, either put it first today or
prescribe a shorter session that actually fits their time.

Coaching rules:
- Within the allowed focuses, favour the weakest triad area; that is where training pays best.
- Train in the within-session hierarchy: skill (fresh) → max strength/power →
  anaerobic endurance → conditioning. Always warm up first.
- Read \`profile.climberContext\` for their gym, what they train for, and their history.
  It is background, not today's body. Do not rest or change the session because of an
  injury that appears only there.
- Be specific and encouraging, never generic.
- Keep the plan concrete and doable in one day (5–10 ordered steps). Every non-lifting
  step must be executable without guessing: exercise name, grip/hold, sets, work/rest,
  and load when a protocol text is provided. Never write "end with fingerboarding" —
  name the protocol (min-edge / 10-second hangs / 7-53 / repeaters L1–L4 / HIT / 4x4 /
  ARC) with the numbers. Lifting (deadlift, squat) may say "use last session's weight".
- When you prescribe finger, strength, power, or endurance work, use the concrete
  protocols in the training reference below — real edge sizes, hang/rest seconds, sets —
  rather than vague instructions.
- \`baselinePlan\` is what the app would prescribe without you. Treat it as the floor: your
  plan should be at least as specific and better tailored, not vaguer.
- THINK IN BLOCKS, NOT JUST TODAY. \`macrocycle.current\` is the training block they are
  in (Hörst Ch 10). Today's session must serve that block, not just the weakest area:
  skill/stamina/mileage blocks = volume of submaximal climbing; max-strength/power blocks
  = short near-limit efforts and isolation, 48h apart; power-endurance blocks = 4x4s /
  repeaters for 2–4 weeks then stop; taper = keep intensity, cut volume ~50% then ~75%,
  last 1–2 days mobility only. A well-chosen session this week that does not fit the
  season is still the wrong session. If no current block is set, assume an all-round
  4-3-2-1 shape for intermediates (4 wk skill/stamina → 3 wk max strength/power →
  2 wk PE → 1 wk taper) and say which phase you are treating today as.

${TRAINING_REFERENCE}

Reply with ONLY a JSON object of this exact shape (no markdown, no prose outside it):
{
  "focusArea": "mental" | "technical" | "physical" | null,
  "headline": string,            // one short line, e.g. "Power day: target finger strength"
  "plan": string[],              // 3–6 ordered, concrete steps for today
  "rationale": string,           // 1–3 sentences citing their data, incl. their recent sessions
  "watchOuts": string[],         // 0–3 short cautions (injury, overtraining, technique)
  "restDay": boolean,            // true if they should rest; MUST be true when schedule.restDay is
  "injuries": [                  // unresolved physical problems you read in their prose; [] if none
    { "note": string, "evidence": string, "bodyPart": string, "noClimbing": boolean }
  ]
}`;

/** A JSON schema Gemini can enforce for structured output. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    focusArea: { type: 'string', nullable: true, enum: ['mental', 'technical', 'physical'] },
    headline: { type: 'string' },
    plan: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
    watchOuts: { type: 'array', items: { type: 'string' } },
    restDay: { type: 'boolean' },
    injuries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          evidence: { type: 'string' },
          bodyPart: { type: 'string' },
          noClimbing: { type: 'boolean' },
        },
        required: ['note', 'bodyPart', 'noClimbing'],
      },
    },
  },
  required: ['headline', 'plan', 'rationale', 'watchOuts', 'restDay', 'injuries'],
};

/**
 * Reject a suggestion that contradicts the scheduler.
 *
 * The prompt states the rest-day rule plainly, but "prescribe rest" is exactly
 * the instruction a helpful model is most tempted to soften into "here's a
 * light session". Making the model restate the verdict gives us something
 * checkable: on a mismatch we throw, the route returns 502, and the client
 * falls back to the deterministic plan — which says rest correctly.
 */
/**
 * Reject a suggestion that contradicts a computed load.
 *
 * Same reasoning as the rest-day check, and the same failure mode: a model
 * handed "+35 lb" is tempted to round it up to a nicer number or add a little
 * for progression. Those numbers are bounded by the climber's measured history,
 * so a "better" one is just an unmeasured one. If the model names the exercise
 * it must carry the number it was given; otherwise we fall back to the
 * deterministic plan, which has it right.
 */
export function assertRespectsPrescriptions(
  suggestion: CoachSuggestion,
  context: CoachContext,
): void {
  const plan = (suggestion.plan ?? []).join('\n').toLowerCase();
  for (const protocol of context.prescriptions?.protocols ?? []) {
    if (!protocol.targetLabel || !protocol.name) continue;
    // Only when the model actually brought that exercise up. Leaving it out
    // entirely is a legitimate coaching choice; renaming its load is not.
    if (!plan.includes(protocol.name.toLowerCase())) continue;
    if (!plan.includes(protocol.targetLabel.toLowerCase())) {
      throw new Error(
        `coach changed the prescribed load for ${protocol.name}; falling back to baseline`,
      );
    }
  }
}

/**
 * A rest day the scheduler did not call, and that no current injury requires,
 * is dropped. Otherwise "resting tomorrow" from two days ago becomes another
 * rest day after the rest was already taken.
 */
export function dropInventedRestDay<T extends CoachSuggestion & { restDay?: boolean }>(
  suggestion: T,
  context: CoachContext,
): T {
  if (suggestion.restDay !== true) return suggestion;
  if (context.schedule?.restDay === true) return suggestion;
  const blocking = (suggestion.injuries ?? []).some((injury) => injury.noClimbing);
  if (blocking) return suggestion;
  return {
    ...suggestion,
    restDay: false,
    plan: context.baselinePlan?.length ? context.baselinePlan : suggestion.plan,
    headline: /rest/i.test(suggestion.headline) ? 'Training day' : suggestion.headline,
  };
}

export function assertRespectsSchedule(
  suggestion: CoachSuggestion & { restDay?: boolean },
  context: CoachContext,
): void {
  // Only the rest-day case is enforced. A model that quietly omits the field on
  // a training day has still produced a usable plan; a model that prescribes a
  // workout on a rest day has not, and that is the failure worth catching.
  if (context.schedule?.restDay !== true) return;
  if (suggestion.restDay !== true) {
    throw new Error('coach prescribed training on a scheduled rest day; falling back to baseline');
  }
}

/** Whether at least one provider key is configured. */
export function isLlmConfigured(): boolean {
  return providerChain().length > 0;
}

/** Usage limits and capacity errors are worth another provider. A 404 is not. */
function shouldFailover(err: unknown): boolean {
  if (!(err instanceof LlmHttpError)) return false;
  return isUsageLimit(err.status, err.detail) || err.status === 503;
}

function coerceInjuries(raw: unknown): CoachInjuryFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      note: String(item.note ?? '').trim(),
      evidence: String(item.evidence ?? '').trim(),
      bodyPart: String(item.bodyPart ?? 'other')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-'),
      noClimbing: Boolean(item.noClimbing),
    }))
    .filter((item) => item.note.length > 0 && item.bodyPart.length > 0);
}

function coerceSuggestion(
  raw: string | Record<string, unknown>,
): CoachSuggestion & { restDay?: boolean } {
  const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  return {
    focusArea: (obj.focusArea ?? null) as CoachSuggestion['focusArea'],
    headline: String(obj.headline || 'Train smart today'),
    plan: Array.isArray(obj.plan) ? obj.plan.map(String) : [],
    rationale: String(obj.rationale || ''),
    watchOuts: Array.isArray(obj.watchOuts) ? obj.watchOuts.map(String) : [],
    injuries: coerceInjuries(obj.injuries),
    ...(typeof obj.restDay === 'boolean' ? { restDay: obj.restDay } : {}),
  };
}

async function callGemini(
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<CoachSuggestion & { restDay?: boolean }> {
  const model = modelFor('gemini');
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetchWithLlmRetries(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
        },
      }),
    },
    (status, detail) =>
      new LlmHttpError(
        status,
        detail,
        `Gemini error ${status} (model ${model}): ${detail.slice(0, 300)}`,
      ),
    { retryUnavailable },
  );
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return coerceSuggestion(text);
}

async function callGroqModel(
  model: string,
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<CoachSuggestion & { restDay?: boolean }> {
  const key = process.env.GROQ_API_KEY;
  // GPT-OSS reasons by default. Low effort, and don't ask for the reasoning
  // text: JSON mode needs the answer in message.content, and a long trace
  // blows the route budget. reasoning_format is not valid on these ids.
  const gptOss = model.startsWith('openai/gpt-oss');
  const res = await fetchWithLlmRetries(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.6,
        ...(gptOss
          ? { reasoning_effort: 'low', include_reasoning: false, max_completion_tokens: 4096 }
          : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(context) },
        ],
      }),
    },
    (status, detail) =>
      new LlmHttpError(
        status,
        detail,
        `Groq error ${status} (model ${model}): ${detail.slice(0, 300)}`,
      ),
    { retryUnavailable },
  );
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq returned no content (model ${model})`);
  return coerceSuggestion(text);
}

async function callGroq(
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<CoachSuggestion & { restDay?: boolean }> {
  const models = groqModelChain();
  let prior: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    const hasNext = i < models.length - 1;
    try {
      return await callGroqModel(models[i], context, hasNext ? false : retryUnavailable);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const missing = err instanceof LlmHttpError && err.status === 404;
      if (!hasNext || !missing) {
        if (prior) throw new Error(`${prior.message} | ${error.message}`);
        throw error;
      }
      console.error(
        `coach: groq model ${models[i]} unavailable (${error.message}); trying ${models[i + 1]}`,
      );
      prior = error;
    }
  }
  throw prior ?? new Error('Groq request failed');
}

async function callProvider(
  id: ProviderId,
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<CoachSuggestion & { restDay?: boolean }> {
  return id === 'groq'
    ? callGroq(context, retryUnavailable)
    : callGemini(context, retryUnavailable);
}

/** Generate a structured coaching suggestion from the app context. */
export async function generateCoachSuggestion(context: CoachContext): Promise<CoachSuggestion> {
  const chain = providerChain();
  if (chain.length === 0) throw new Error('AI coach not configured');
  let prior: Error | null = null;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    const hasNext = i < chain.length - 1;
    try {
      const raw = await callProvider(id, context, !hasNext);
      assertRespectsSchedule(raw, context);
      assertRespectsPrescriptions(raw, context);
      return dropInventedRestDay(raw, context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!hasNext || !shouldFailover(err)) {
        if (prior) throw new Error(`${prior.message} | ${error.message}`);
        throw error;
      }
      console.error(`coach: ${id} unavailable (${error.message}); trying ${chain[i + 1]}`);
      prior = error;
    }
  }
  throw prior ?? new Error('LLM request failed');
}
