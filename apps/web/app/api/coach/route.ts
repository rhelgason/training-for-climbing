/**
 * POST /api/coach — turn the app's training context into a coaching suggestion.
 *
 * Was a proxy to the Railway server's /coach; now the implementation itself
 * (ported from `server/index.js`). With no LLM key configured this returns 503
 * and the app falls back to its deterministic baseline.
 */
import { NextResponse } from 'next/server';
import type { CoachContext } from '@tfc/core';
import { generateCoachSuggestion, isLlmConfigured } from '../../../lib/server/llm';
import { readJson, withUser } from '../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The upstream model call is slower than the default serverless budget.
export const maxDuration = 60;

export function POST(req: Request) {
  return withUser(req, 'POST /api/coach', async () => {
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'AI coach not configured' }, { status: 503 });
    }
    const body = await readJson<{ context?: CoachContext }>(req);
    const context = body?.context;
    if (!context || typeof context !== 'object') {
      return NextResponse.json({ error: 'missing context' }, { status: 400 });
    }
    try {
      const suggestion = await generateCoachSuggestion(context);
      return NextResponse.json({ suggestion });
    } catch (err) {
      // Distinguish an upstream model failure (502) from our own (500) — the
      // client treats both as "fall back to the baseline", but the logs matter.
      console.error('POST /api/coach upstream failed', err);
      return NextResponse.json({ error: 'coach upstream error' }, { status: 502 });
    }
  });
}
