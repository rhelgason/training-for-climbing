/**
 * Provider-agnostic LLM adapter for the AI Coach.
 *
 * Ported verbatim in behaviour from the standalone Express server
 * (`server/llm.js`) when the backend moved into Next route handlers.
 *
 * Default provider is Google **Gemini 2.5 Flash**, whose free tier covers this
 * app's volume (a few users × a handful of prompts/week) at $0. Groq
 * (Llama-3.3-70B) is a drop-in alternative. Both are called over plain REST so
 * the app needs no extra npm dependency.
 *
 * Swapping to a paid / no-train provider later is a one-module change: add a
 * branch here keyed off `LLM_PROVIDER`; the app and the `/api/coach` route are
 * unchanged.
 *
 * Env:
 *   LLM_PROVIDER     – 'gemini' (default) | 'groq'
 *   GEMINI_API_KEY   – free key from https://aistudio.google.com/apikey
 *   GROQ_API_KEY     – free key from https://console.groq.com/keys
 *   LLM_MODEL        – optional model override
 */
import type { CoachContext, CoachSuggestion } from '@tfc/core';
import { TRAINING_REFERENCE } from './coachKnowledge';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
};

/** The static coaching brief sent on every call. */
const SYSTEM_PROMPT = `You are an expert climbing coach writing one climber's session for today.
You are given a structured context: their self-assessment of the performance triad (mental,
technical, physical), fitness benchmarks, recent climbs, goals, a daily journal, what they have
available today, and — most importantly — \`schedule\`, the result of a training-load calculation
already performed for you. Give advice in your own voice; do not cite books, authors, or
external sources.

HARD CONSTRAINTS. These are computed from the climber's actual logged history and are not
suggestions. Violating one produces a plan that will injure or overtrain them:
- If \`schedule.restDay\` is true, prescribe a REST day. Do not find a workout that "still
  counts". Say why, using \`schedule.restReason\`, and give recovery guidance only.
- Prescribe ONLY focuses listed in \`schedule.allowed\`. Never prescribe anything in
  \`schedule.blocked\` — each carries the reason it is out (too soon since the last one, weekly
  ceiling reached, equipment missing, or they reported feeling beaten up).
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
\`daysAgo: 1\` is yesterday. Before choosing anything, read the last three days: what they
trained, how hard it was, and what their free text says about how their body felt. Today's
session must make sense as the *next* one after those. State the connection explicitly in your
rationale — "your fingers took a hard max-hang session yesterday, so today is…". If they
mentioned soreness, a tweak, or fatigue in a recent entry, respond to it by name. Their free
text is the highest-signal thing you have: grades attempted, where they pumped out, what felt
off. Use the specifics rather than restating them. \`skipped\` lists steps they were prescribed
but didn't get to — if the same block keeps getting dropped, either put it first today or
prescribe a shorter session that actually fits their time.

Coaching rules:
- Within the allowed focuses, favour the weakest triad area; that is where training pays best.
- Train in the within-session hierarchy: skill (fresh) → max strength/power →
  anaerobic endurance → conditioning. Always warm up first.
- Read \`profile.climberContext\` — the climber's own description of themselves — and honour
  what it says about injuries, their gym, and what they are training for.
- \`profile.derivedContext\` is things the app noticed and the climber confirmed, most often a
  niggle they mentioned repeatedly. Treat it as true and work around it: if it names a sore
  tendon, do not prescribe maximal loading of it, and say why you changed the session. It is
  kept separate from their own words because it was inferred — do not quote it back as
  something they told you.
- Be specific and encouraging, never generic.
- Keep the plan concrete and doable in one day (3–6 ordered steps).
- When you prescribe finger, strength, power, or endurance work, use the concrete
  protocols in the training reference below — real edge sizes, hang/rest seconds, sets —
  rather than vague instructions.
- \`baselinePlan\` is what the app would prescribe without you. Treat it as the floor: your
  plan should be at least as specific and better tailored, not vaguer.

${TRAINING_REFERENCE}

Reply with ONLY a JSON object of this exact shape (no markdown, no prose outside it):
{
  "focusArea": "mental" | "technical" | "physical" | null,
  "headline": string,            // one short line, e.g. "Power day: target finger strength"
  "plan": string[],              // 3–6 ordered, concrete steps for today
  "rationale": string,           // 1–3 sentences citing their data, incl. their recent sessions
  "watchOuts": string[],         // 0–3 short cautions (injury, overtraining, technique)
  "restDay": boolean             // MUST equal schedule.restDay — it is checked
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
  },
  required: ['headline', 'plan', 'rationale', 'watchOuts', 'restDay'],
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

/** Read env at call time so route handlers see request-time configuration. */
function provider(): string {
  return (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
}

function modelName(): string {
  return process.env.LLM_MODEL || DEFAULT_MODELS[provider()] || DEFAULT_MODELS.gemini;
}

/** Whether a usable provider key is configured. */
export function isLlmConfigured(): boolean {
  if (provider() === 'groq') return Boolean(process.env.GROQ_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
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
    restDay: typeof obj.restDay === 'boolean' ? obj.restDay : undefined,
  };
}

async function callGemini(context: CoachContext): Promise<CoachSuggestion & { restDay?: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName()}:generateContent?key=${key}`;
  const res = await fetch(url, {
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
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return coerceSuggestion(text);
}

async function callGroq(context: CoachContext): Promise<CoachSuggestion & { restDay?: boolean }> {
  const key = process.env.GROQ_API_KEY;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelName(),
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(context) },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no content');
  return coerceSuggestion(text);
}

/** Generate a structured coaching suggestion from the app context. */
export async function generateCoachSuggestion(context: CoachContext): Promise<CoachSuggestion> {
  const raw = provider() === 'groq' ? await callGroq(context) : await callGemini(context);
  assertRespectsSchedule(raw, context);
  assertRespectsPrescriptions(raw, context);
  // `restDay` is a validation channel, not part of the client's contract.
  const { restDay: _restDay, ...suggestion } = raw;
  return suggestion;
}
