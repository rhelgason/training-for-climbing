/**
 * Provider-agnostic LLM adapter for the AI Coach.
 *
 * Gemini is tried first. Any failure of a provider — a dead model, a usage
 * limit, a 5xx, a timeout, an empty or unparseable reply, a plan that breaks
 * the scheduler — moves to the next provider that has a key. A missing key is
 * skipped. The phone never chooses. A 404 walks that provider's other model
 * ids before leaving, because a retired id is not the same as an exhausted
 * account. A 429 leaves immediately: another model on the same key usually
 * shares the quota, and retrying it is how a few refreshes became "you have
 * exceeded your quota".
 *
 * Keys are read with dynamic `process.env` access so Next does not inline a
 * value from build time. A new key is picked up on the next Vercel deploy.
 *
 * Env (any one is enough; more are backups):
 *   GEMINI_API_KEY         – https://aistudio.google.com/apikey
 *   GROQ_API_KEY           – https://console.groq.com/keys
 *   OPENROUTER_API_KEY     – https://openrouter.ai/keys  (free models only)
 *   CLOUDFLARE_ACCOUNT_ID  – Workers AI, with CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_API_TOKEN   – https://dash.cloudflare.com/profile/api-tokens
 *   MISTRAL_API_KEY        – https://console.mistral.ai
 *   XAI_API_KEY            – paid last resort, https://console.x.ai
 *   LLM_PROVIDER           – which configured provider is tried first
 *   LLM_MODEL              – Groq override only. Retired ids are ignored.
 */
import {
  log,
  suggestionLooksLikeRest,
  type CoachContext,
  type CoachInjuryFinding,
  type CoachSuggestion,
} from '@tfc/core';
import { TRAINING_REFERENCE } from './coachKnowledge';
import { fetchWithLlmRetries, LlmHttpError } from './llmRetry';

type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'cloudflare' | 'mistral' | 'xai';

/** Tried in this order. `LLM_PROVIDER` moves one of them to the front. */
const PROVIDER_ORDER: ProviderId[] = [
  'gemini',
  'groq',
  'openrouter',
  'cloudflare',
  'mistral',
  'xai',
];

const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'openai/gpt-oss-120b',
  openrouter: 'google/gemma-4-31b-it:free',
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  mistral: 'mistral-small-latest',
  xai: 'grok-4.7',
};

/**
 * Same Gemini key, second id, only after a 404. 3.6 and 3.5 both accept
 * thinkingLevel "minimal". A newer Flash that rejects "minimal" would 400
 * and the chain would move on.
 */
const GEMINI_MODEL_FALLBACKS = ['gemini-3.6-flash', 'gemini-3.5-flash'];

/** Free OpenRouter ids as of 2026-10-04. One request; OpenRouter walks the list. */
const OPENROUTER_FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-26b-a4b-it:free',
];

const CLOUDFLARE_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
];

/** Leave the route ~10s to answer after the last attempt starts. */
const ROUTE_BUDGET_MS = 50_000;

/** Dynamic lookup. Next inlines a literal `process.env.NAME` at build time. */
function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

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
  const requested = env('LLM_PROVIDER').toLowerCase();
  return PROVIDER_ORDER.includes(requested as ProviderId) ? (requested as ProviderId) : 'gemini';
}

function hasKey(id: ProviderId): boolean {
  switch (id) {
    case 'gemini':
      return env('GEMINI_API_KEY').length > 0;
    case 'groq':
      return env('GROQ_API_KEY').length > 0;
    case 'openrouter':
      return env('OPENROUTER_API_KEY').length > 0;
    case 'cloudflare':
      return env('CLOUDFLARE_API_TOKEN').length > 0 && env('CLOUDFLARE_ACCOUNT_ID').length > 0;
    case 'mistral':
      return env('MISTRAL_API_KEY').length > 0;
    case 'xai':
      return env('XAI_API_KEY').length > 0;
  }
}

function modelFor(id: ProviderId): string {
  if (id === 'groq') {
    const requested = env('LLM_MODEL');
    // Gemini ignores LLM_MODEL, and Groq must ignore it too when the value is
    // a Gemini id or a model Groq has retired. A leftover gemini-2.5-flash or
    // llama-3.3-70b-versatile is how the 404 keeps coming back.
    const unusable =
      !requested ||
      /^models\/gemini|^gemini/i.test(requested) ||
      RETIRED_GROQ_MODELS.has(requested);
    return unusable ? DEFAULT_MODELS.groq : requested;
  }
  return DEFAULT_MODELS[id];
}

function groqModelChain(): string[] {
  const primary = modelFor('groq');
  return [primary, ...GROQ_MODEL_FALLBACKS.filter((id) => id !== primary)];
}

/**
 * Providers that can actually be called, preferred first. A key that is not
 * set is skipped, so Gemini-as-default still falls through when only a later
 * key is present.
 */
export function providerChain(): ProviderId[] {
  const have = PROVIDER_ORDER.filter(hasKey);
  const preferred = preferredProvider();
  const primary = have.includes(preferred) ? preferred : have[0];
  if (!primary) return [];
  return [primary, ...have.filter((id) => id !== primary)];
}

/** Model id of every configured provider, in the order they will be tried. */
export function llmChain(): string[] {
  return providerChain().map(modelFor);
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
  pain-free, or they trained on it, do not avoid loading it and do not include it in
  \`injuries\`. Ordinary pump and next-day soreness are not injuries.
- The scheduler is the only authority on whether today is a rest day. \`restDay\` MUST equal
  \`schedule.restDay\`. You may not invent a rest, a day off, a deload, active recovery,
  a mobility-only day, "take it easy", or "no climbing" when \`schedule.restDay\` is false.
  Not for a journal sentence, not for soreness, not for a weekly count, and not because you
  set \`injuries[].noClimbing\`. If \`schedule.injury\` is null, \`injuries\` is [].
- If a newest entry describes a fresh tear, MRI, or not being able to climb and
  \`schedule.injury\` is null, name it in \`watchOuts\` and keep today's work off that
  tissue. Still do not set \`restDay\`. The scheduler already decided the day is for training.
- \`schedule.injury\` is a keyword reading of those same recent entries, not a record that
  outlives them. If \`schedule.restDay\` is true because of it, prescribe REST / rehab only —
  no performance climbing, hangboard, campus, or limit boulders. If \`noHighIntensity\` is
  true, do not prescribe max strength, power, or power-endurance, and still write a real
  session from what \`schedule.allowed\` leaves.
- If \`schedule.restDay\` is true, prescribe a REST day. Do not find a workout that "still
  counts". Say why, using \`schedule.restReason\`, and give recovery guidance only.
- If \`schedule.restDay\` is false and \`schedule.offFingers\` is not true, write a real
  training session that fills \`today.sessionLength\`. Prefer the hardest focus in
  \`schedule.allowed\` that serves \`macrocycle.current\`. Do not shorten it, soften it,
  or turn it into an easy day.
- If \`schedule.offFingers\` is true, the hands are due off. That is three finger days
  running, or four specific days in the last seven (\`fingerDaysInARow\`, \`fingerDaysThisWeek\`).
  \`restDay\` is false. This is a training day off the wall: antagonist and core lifting
  (use last-logged weight, do not invent one), 20–30 minutes of easy running, rowing, or
  cycling at conversation pace, and a real stretching block. Do not put them on the wall,
  a hangboard, a campus board, limit boulders, or ARC. Do not turn it into a day off or a walk.
- \`profile.trainingPush\` is \`full-time\` unless it says \`steady\`. Full-time means this
  climber is trying to improve quickly and trains most days. The weekly day-count is not a
  reason to rest them or to write an easier session. Push the best work they are allowed to do.
- \`schedule.fulfilledRests\` are rests they already announced, including one whose sentence
  points at today. "Tomorrow" and "today" inside a journal are relative to that entry's
  \`daysAgo\`, not to now. An entry with \`daysAgo: 2\` that says "I'm fully resting tomorrow"
  is about yesterday. If that day is in \`fulfilledRests\`, or \`recentDays\` shows it as Rest
  with no session logged, the rest already happened. If \`daysAgo: 1\` is Rest, yesterday was
  the rest day — today is not another one unless \`schedule.restDay\` is true. Do not set
  \`restDay\`, and do not write a rest plan, an easy day, or active recovery to honour a rest
  that already happened. Naming a rest never makes today a rest day.
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
  "restDay": boolean,            // MUST equal schedule.restDay. Never true when it is false.
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
 * A day off the scheduler did not call is dropped, including one written as an
 * easy day, active recovery, or "no climbing" with `restDay` left false.
 * A model injury does not get to overrule that. "Rest 3 minutes" inside a real
 * session is not a rest day.
 */
/** Work that grips a hold. The off-finger session must not contain these. */
const FINGER_WORK =
  /\b(hangboard|fingerboard|campus|limit boulder|limit boulders|arc|repeater|half-crimp|open-hand|bouldering|boulder problem|climb|climbing|routes?|crimp)\b/i;

function looksLikeRest(headline: string, plan: string[]): boolean {
  return suggestionLooksLikeRest({ headline, plan });
}

function looksLikeFingerWork(plan: string[]): boolean {
  return FINGER_WORK.test(plan.join('\n'));
}

function baselineSteps(context: CoachContext): string[] {
  return (context.baselinePlan ?? []).map((step) => step.trim()).filter(Boolean);
}

export function dropInventedRestDay<T extends CoachSuggestion & { restDay?: boolean }>(
  suggestion: T,
  context: CoachContext,
): T {
  // Three finger days, or four in the week: the model does not get to climb
  // or to send them home. The built-in session is lifting, cardio, stretching.
  if (context.schedule?.offFingers === true) {
    const baseline = baselineSteps(context);
    const usable =
      baseline.length > 0 && !looksLikeRest('', baseline) && !looksLikeFingerWork(baseline);
    const inventedRest =
      suggestion.restDay === true || looksLikeRest(suggestion.headline, suggestion.plan ?? []);
    const inventedClimbing = looksLikeFingerWork(suggestion.plan ?? []);
    if (usable && (inventedRest || inventedClimbing)) {
      log.info('coach: replaced an off-finger suggestion', {
        headline: suggestion.headline,
        inventedRest,
        inventedClimbing,
      });
      return { ...suggestion, restDay: false, plan: baseline, headline: 'Off the fingers' };
    }
    if (suggestion.restDay) {
      log.info('coach: cleared a rest flag on an off-finger day', {
        headline: suggestion.headline,
      });
    }
    return { ...suggestion, restDay: false };
  }
  if (context.schedule?.restDay === true) return suggestion;
  const inventedFlag = suggestion.restDay === true;
  const shaped = looksLikeRest(suggestion.headline, suggestion.plan ?? []);
  if (!inventedFlag && !shaped) return suggestion;
  const baseline = baselineSteps(context);
  const plan = baseline.length > 0 && !looksLikeRest('', baseline) ? baseline : suggestion.plan;
  log.info('coach: dropped an invented rest day', {
    headline: suggestion.headline,
    inventedFlag,
    shaped,
    usedBaseline: plan === baseline,
  });
  return {
    ...suggestion,
    restDay: false,
    plan,
    headline: looksLikeRest(suggestion.headline, []) ? 'Training day' : suggestion.headline,
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

/** Models wrap JSON in prose or a fence. Take the object either way. */
function parseModelJson(text: string): Record<string, unknown> {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const asObject = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  try {
    const parsed = asObject(JSON.parse(trimmed));
    if (parsed) return parsed;
  } catch {
    // The answer has text around the object. Slice to the outer braces.
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = asObject(JSON.parse(trimmed.slice(start, end + 1)));
    if (parsed) return parsed;
  }
  throw new Error('model returned text that is not JSON');
}

function coerceSuggestion(
  raw: string | Record<string, unknown>,
): CoachSuggestion & { restDay?: boolean } {
  const obj = typeof raw === 'string' ? parseModelJson(raw) : raw;
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

type Suggestion = CoachSuggestion & { restDay?: boolean };

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

/** Skip a thought part. The JSON is the part that is not a thought. */
function geminiAnswerText(body: {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}): string {
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const answer = parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  if (answer.trim()) return answer;
  return parts
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

/**
 * A 404 means that model id is gone. Try the next id on the same key.
 * Anything else — quota, 5xx, timeout, bad JSON — is the provider's problem,
 * and the caller moves to the next provider.
 */
async function tryModels(
  label: string,
  models: string[],
  retryLast: boolean,
  call: (model: string, retryUnavailable: boolean) => Promise<Suggestion>,
): Promise<Suggestion> {
  let prior: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    const hasNext = i < models.length - 1;
    try {
      // A 503 retry belongs on this model when the provider itself is last.
      // The next model id is only for a 404, which is not retried.
      return await call(models[i], retryLast);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const missing = err instanceof LlmHttpError && err.status === 404;
      if (!hasNext || !missing) {
        if (prior) throw new Error(`${prior.message} | ${error.message}`);
        throw error;
      }
      log.error(
        `coach: ${label} model ${models[i]} missing (${error.message}); trying ${models[i + 1]}`,
      );
      prior = error;
    }
  }
  throw prior ?? new Error(`${label} request failed`);
}

async function callGeminiModel(
  model: string,
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<Suggestion> {
  const key = env('GEMINI_API_KEY');
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
          // 3.6 Flash thinks at medium by default. That spends the free quota
          // and can return an empty answer when thinking uses the whole budget.
          thinkingConfig: { thinkingLevel: 'minimal' },
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
  const body = (await res.json()) as Parameters<typeof geminiAnswerText>[0];
  const text = geminiAnswerText(body);
  if (!text.trim()) throw new Error(`Gemini returned no content (model ${model})`);
  return coerceSuggestion(text);
}

interface OpenAiCall {
  label: string;
  url: string;
  key: string;
  model: string;
  context: CoachContext;
  retryUnavailable: boolean;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
}

async function callOpenAiCompatible(options: OpenAiCall, jsonMode: boolean): Promise<Suggestion> {
  const res = await fetchWithLlmRetries(
    options.url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.key}`,
        ...options.extraHeaders,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.6,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(options.context) },
        ],
        ...options.extraBody,
      }),
    },
    (status, detail) =>
      new LlmHttpError(
        status,
        detail,
        `${options.label} error ${status} (model ${options.model}): ${detail.slice(0, 300)}`,
      ),
    { retryUnavailable: options.retryUnavailable },
  );
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${options.label} returned no content (model ${options.model})`);
  return coerceSuggestion(text);
}

/** Some hosts reject JSON mode. One plain-text retry, then the caller moves on. */
async function callOpenAi(options: OpenAiCall): Promise<Suggestion> {
  try {
    return await callOpenAiCompatible(options, true);
  } catch (err) {
    const rejected =
      err instanceof LlmHttpError &&
      err.status === 400 &&
      /response_format|json_object|json mode/i.test(err.detail);
    if (!rejected) throw err;
    log.error(`coach: ${options.label} rejected JSON mode; retrying as plain text`);
    return callOpenAiCompatible({ ...options, retryUnavailable: false }, false);
  }
}

async function callGemini(context: CoachContext, retryUnavailable: boolean): Promise<Suggestion> {
  return tryModels('gemini', GEMINI_MODEL_FALLBACKS, retryUnavailable, (model, retry) =>
    callGeminiModel(model, context, retry),
  );
}

async function callGroq(context: CoachContext, retryUnavailable: boolean): Promise<Suggestion> {
  return tryModels('groq', groqModelChain(), retryUnavailable, (model, retry) =>
    callOpenAi({
      label: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: env('GROQ_API_KEY'),
      model,
      context,
      retryUnavailable: retry,
      // GPT-OSS reasons by default. Low effort, and don't ask for the
      // reasoning text: JSON mode needs the answer in message.content.
      // reasoning_format is not valid on these ids.
      extraBody: model.startsWith('openai/gpt-oss')
        ? { reasoning_effort: 'low', include_reasoning: false, max_completion_tokens: 4096 }
        : { max_tokens: 2048 },
    }),
  );
}

async function callOpenRouter(
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<Suggestion> {
  return callOpenAi({
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: env('OPENROUTER_API_KEY'),
    model: OPENROUTER_FREE_MODELS[0],
    context,
    retryUnavailable,
    extraHeaders: {
      'HTTP-Referer': 'https://training-for-climbing-helgasonryan.vercel.app',
      'X-Title': 'Training for Climbing',
    },
    // One HTTP call. OpenRouter walks the free ids. max_price 0 refuses a
    // route that would bill the account if a :free id is dropped.
    extraBody: {
      models: OPENROUTER_FREE_MODELS,
      max_tokens: 2048,
      provider: { max_price: { prompt: 0, completion: 0 } },
    },
  });
}

async function callCloudflare(
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<Suggestion> {
  const account = env('CLOUDFLARE_ACCOUNT_ID');
  return tryModels('cloudflare', CLOUDFLARE_MODELS, retryUnavailable, (model, retry) =>
    callOpenAi({
      label: 'Cloudflare',
      url: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`,
      key: env('CLOUDFLARE_API_TOKEN'),
      model,
      context,
      retryUnavailable: retry,
      extraBody: { max_tokens: 2048 },
    }),
  );
}

async function callMistral(context: CoachContext, retryUnavailable: boolean): Promise<Suggestion> {
  return callOpenAi({
    label: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: env('MISTRAL_API_KEY'),
    model: DEFAULT_MODELS.mistral,
    context,
    retryUnavailable,
    extraBody: { max_tokens: 2048 },
  });
}

async function callXai(context: CoachContext, retryUnavailable: boolean): Promise<Suggestion> {
  return callOpenAi({
    label: 'xAI',
    url: 'https://api.x.ai/v1/chat/completions',
    key: env('XAI_API_KEY'),
    model: DEFAULT_MODELS.xai,
    context,
    retryUnavailable,
    extraBody: { reasoning_effort: 'low', max_tokens: 4096 },
  });
}

async function callProvider(
  id: ProviderId,
  context: CoachContext,
  retryUnavailable: boolean,
): Promise<Suggestion> {
  switch (id) {
    case 'gemini':
      return callGemini(context, retryUnavailable);
    case 'groq':
      return callGroq(context, retryUnavailable);
    case 'openrouter':
      return callOpenRouter(context, retryUnavailable);
    case 'cloudflare':
      return callCloudflare(context, retryUnavailable);
    case 'mistral':
      return callMistral(context, retryUnavailable);
    case 'xai':
      return callXai(context, retryUnavailable);
  }
}

/** Generate a structured coaching suggestion from the app context. */
export async function generateCoachSuggestion(context: CoachContext): Promise<CoachSuggestion> {
  const chain = providerChain();
  if (chain.length === 0) throw new Error('AI coach not configured');
  const started = Date.now();
  let prior: Error | null = null;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    const hasNext = i < chain.length - 1;
    // A hung chain must not start another attempt it cannot finish. The
    // route budget is 60s; leave the last answer time to come back.
    if (prior && Date.now() - started > ROUTE_BUDGET_MS - 8_000) {
      throw new Error(`${prior.message} | stopped before ${id}: the route budget was almost gone`);
    }
    try {
      const raw = await callProvider(id, context, !hasNext);
      assertRespectsSchedule(raw, context);
      assertRespectsPrescriptions(raw, context);
      return dropInventedRestDay(raw, context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!hasNext) {
        if (prior) throw new Error(`${prior.message} | ${error.message}`);
        throw error;
      }
      log.error(`coach: ${id} unavailable (${error.message}); trying ${chain[i + 1]}`);
      prior = error;
    }
  }
  throw prior ?? new Error('LLM request failed');
}
