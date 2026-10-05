/**
 * POST /api/coach — turn the app's training context into a coaching suggestion.
 *
 * Was a proxy to the Railway server's /coach; now the implementation itself
 * (ported from `server/index.js`). With no LLM key configured this returns 503
 * and the app falls back to its deterministic baseline.
 */
import { NextResponse } from 'next/server';
import { log, type CoachContext } from '@tfc/core';
import { generateCoachRun, isLlmConfigured, providerChain } from '../../../lib/server/llm';
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
    const started = Date.now();
    log.info('POST /api/coach', {
      providers: providerChain(),
      restDay: context.schedule?.restDay,
      restReason: context.schedule?.restReason,
      offFingers: context.schedule?.offFingers ?? false,
      fingerDaysInARow: context.schedule?.fingerDaysInARow,
      fingerDaysThisWeek: context.schedule?.fingerDaysThisWeek,
      suggestedFocus: context.schedule?.suggestedFocus,
      readiness: context.today?.readiness,
      trainingPush: context.profile?.trainingPush,
      injury: context.schedule?.injury?.summary,
    });
    try {
      const run = await generateCoachRun(context);
      log.info('POST /api/coach done', {
        ms: Date.now() - started,
        provider: run.provider,
        model: run.model,
        restDay: run.suggestion.restDay ?? false,
        headline: run.suggestion.headline,
        steps: run.suggestion.plan.length,
      });
      return NextResponse.json({ suggestion: run.suggestion });
    } catch (err) {
      // Surface the real upstream reason — this app has two users, and a
      // generic "coach upstream error" made a broken key/model undiagnosable.
      const message = err instanceof Error ? err.message : 'coach upstream error';
      log.error('POST /api/coach upstream failed', {
        message,
        ms: Date.now() - started,
        providers: providerChain(),
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
