/**
 * Reading the journal for things the climber never put in their profile.
 *
 * The deterministic side of the insight system can see grades, because grades
 * are logged as data. It cannot see "my ring finger has been grumbling on
 * crimps for two weeks", because that only ever exists as prose. Extraction is
 * the one job here a language model is genuinely better at, and it is
 * deliberately the *only* job it is given: it reports what the climber wrote,
 * it does not decide what to do about it.
 *
 * The output is a proposal. Nothing reaches the training plan until the climber
 * taps accept — which matters more here than for the grade detector, because a
 * false positive that makes the app deload you is mildly annoying while a
 * missed injury that keeps loading a hurt tendon is not.
 */
import type { JournalEntry } from '@tfc/core';

/** Entries older than this say little about how the climber feels now. */
const WINDOW_DAYS = 45;
/** Cap the prompt: recent prose is the signal, the archive is noise. */
const MAX_ENTRIES = 25;

const SYSTEM_PROMPT = `You read a climber's training journal and report physical problems they
have written about themselves. You are an extractor, not a coach or a doctor: you report what
they said, you do not diagnose, treat, or advise.

Report a problem ONLY when it meets all of these:
- It is a physical niggle, pain, tweak, strain, or injury affecting their climbing.
- They mention it on at least TWO separate days. A single mention of sore forearms after a hard
  session is ordinary training, not a problem worth changing their plan over.
- It appears unresolved — they have not written that it cleared up.

For each one, give:
- "note": one plain sentence in the third person, naming the body part and roughly when it
  started, e.g. "Right ring finger has been sore on crimps since early August." No advice.
- "evidence": a short quote or close paraphrase from their entries, so they can see why.
- "bodyPart": a short lowercase slug, e.g. "right-ring-finger", "left-shoulder", "elbow".

Report nothing at all if nothing qualifies — an empty list is the correct and common answer.
Do not report general tiredness, soreness the day after a hard session, motivation, or anything
that is not a physical problem. Do not invent detail that is not in the entries.

Reply with ONLY a JSON object: { "findings": [ { "note": string, "evidence": string,
"bodyPart": string } ] }`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          evidence: { type: 'string' },
          bodyPart: { type: 'string' },
        },
        required: ['note', 'evidence', 'bodyPart'],
      },
    },
  },
  required: ['findings'],
};

export interface JournalFinding {
  note: string;
  evidence: string;
  bodyPart: string;
}

/** The free text of recent entries, with dates, or null if there's too little to scan. */
export function scannableEntries(journals: JournalEntry[], nowMs: number): string | null {
  const cutoff = nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = journals
    .filter((j) => j.date >= cutoff && j.date <= nowMs)
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_ENTRIES)
    .map((j) => {
      const text = [j.summary, j.wins, j.struggles].filter(Boolean).join(' ').trim();
      return text ? `${new Date(j.date).toISOString().slice(0, 10)}: ${text}` : null;
    })
    .filter((line): line is string => line !== null);

  // Two entries can't establish the "mentioned on two separate days" rule, so
  // there is nothing a scan could legitimately conclude.
  return recent.length < 2 ? null : recent.join('\n');
}

function coerceFindings(text: string): JournalFinding[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('journal scan returned invalid JSON');
  }
  const findings = (parsed as { findings?: unknown })?.findings;
  if (!Array.isArray(findings)) return [];
  return findings
    .filter(
      (f): f is JournalFinding =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as JournalFinding).note === 'string' &&
        typeof (f as JournalFinding).bodyPart === 'string',
    )
    .map((f) => ({
      note: f.note.trim(),
      evidence: String(f.evidence ?? '').trim(),
      bodyPart: f.bodyPart.trim().toLowerCase().replace(/\s+/g, '-'),
    }))
    .filter((f) => f.note.length > 0 && f.bodyPart.length > 0);
}

/**
 * Scan recent journal prose for unresolved physical problems.
 *
 * Gemini only: this is a cheap, occasional call and the coach's provider
 * switch exists for the session prompt, not for this.
 */
export async function scanJournals(text: string): Promise<JournalFinding[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('journal scan needs GEMINI_API_KEY');
  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // Low: this is extraction. Creativity here means invention.
          temperature: 0.1,
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`journal scan error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = await res.json();
  const out = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error('journal scan returned no content');
  return coerceFindings(out);
}
