/**
 * Provider-agnostic LLM adapter for the AI Coach.
 *
 * Default provider is Google **Gemini 2.5 Flash**, whose free tier covers this
 * app's volume (a few users × a handful of prompts/week) at $0. Groq
 * (Llama-3.3-70B) is a drop-in alternative. Both are called over plain REST so
 * the server needs no extra npm dependency (Node 20+ has global `fetch`).
 *
 * Swapping to a paid / no-train provider later is a one-module change: add a
 * branch here keyed off `LLM_PROVIDER`; the app and the `/coach` route are
 * unchanged.
 *
 * Env:
 *   LLM_PROVIDER     – 'gemini' (default) | 'groq'
 *   GEMINI_API_KEY   – free key from https://aistudio.google.com/apikey
 *   GROQ_API_KEY     – free key from https://console.groq.com/keys
 *   LLM_MODEL        – optional model override
 */

const { TRAINING_REFERENCE } = require('./coachKnowledge');

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
};

/** The static coaching brief sent on every call. */
const SYSTEM_PROMPT = `You are an expert climbing coach. You advise one climber using the
structured context they provide (a self-assessment of the performance triad — mental, technical,
physical — plus fitness benchmarks, recent climbs, goals, a daily journal, and their training
streak). Give advice in your own voice; do not cite books, authors, or external sources.

Coaching rules:
- Target the weakest triad area; that is where training yields the most improvement.
- Respect recovery: if the climber has trained ~3+ days in a row, prescribe rest.
- Train in the within-session hierarchy: skill (fresh) → max strength/power →
  anaerobic endurance → conditioning. Always warm up first.
- Read the journal free-text for context (fatigue, tweaks, motivation, what's working) and
  reflect it back; be specific and encouraging, never generic.
- Keep the plan concrete and doable in one day (3–6 ordered steps).
- When you prescribe finger, strength, power, or endurance work, use the concrete
  protocols in the training reference below — real edge sizes, hang/rest seconds, sets,
  and added weight scaled to the climber's ability — rather than vague instructions.

${TRAINING_REFERENCE}

Reply with ONLY a JSON object of this exact shape (no markdown, no prose outside it):
{
  "focusArea": "mental" | "technical" | "physical" | null,
  "headline": string,            // one short line, e.g. "Power day: target finger strength"
  "plan": string[],              // 3–6 ordered, concrete steps for today
  "rationale": string,           // 1–3 sentences citing their data
  "watchOuts": string[]          // 0–3 short cautions (injury, overtraining, technique)
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
  },
  required: ['headline', 'plan', 'rationale', 'watchOuts'],
};

function modelName() {
  return process.env.LLM_MODEL || DEFAULT_MODELS[PROVIDER] || DEFAULT_MODELS.gemini;
}

/** Whether a usable provider key is configured. */
function isLlmConfigured() {
  if (PROVIDER === 'groq') return Boolean(process.env.GROQ_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

function coerceSuggestion(raw) {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    focusArea: obj.focusArea ?? null,
    headline: String(obj.headline || 'Train smart today'),
    plan: Array.isArray(obj.plan) ? obj.plan.map(String) : [],
    rationale: String(obj.rationale || ''),
    watchOuts: Array.isArray(obj.watchOuts) ? obj.watchOuts.map(String) : [],
  };
}

async function callGemini(context) {
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

async function callGroq(context) {
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
async function generateCoachSuggestion(context) {
  if (PROVIDER === 'groq') return callGroq(context);
  return callGemini(context);
}

module.exports = { generateCoachSuggestion, isLlmConfigured, PROVIDER };
