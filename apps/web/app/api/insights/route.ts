/**
 * POST /api/insights — scan recent journal prose for unresolved physical problems.
 *
 * Returns *proposals*. Nothing here changes the climber's profile or their
 * training plan; the client shows each one as a card to accept or decline. The
 * deterministic half of the insight system (ability-tier drift) needs no server
 * at all and runs on-device — this endpoint exists only for the part that has
 * to read free text.
 *
 * With no LLM key configured this returns 503 and the client simply shows no
 * journal-derived insights, which is a fine state to be in.
 */
import { NextResponse } from 'next/server';
import type { JournalEntry } from '@tfc/core';
import { scanJournals, scannableEntries } from '../../../lib/server/journalScan';
import { isLlmConfigured } from '../../../lib/server/llm';
import { readJson, withUser } from '../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function POST(req: Request) {
  return withUser(req, 'POST /api/insights', async () => {
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
    }
    const body = await readJson<{ journals?: JournalEntry[]; nowMs?: number }>(req);
    const journals = body?.journals;
    if (!Array.isArray(journals)) {
      return NextResponse.json({ error: 'missing journals' }, { status: 400 });
    }

    const text = scannableEntries(journals, body?.nowMs ?? Date.now());
    // Too little prose to establish anything. Not an error — most climbers most
    // of the time — so answer normally with nothing found.
    if (text === null) return NextResponse.json({ findings: [] });

    try {
      return NextResponse.json({ findings: await scanJournals(text) });
    } catch (err) {
      console.error('POST /api/insights upstream failed', err);
      return NextResponse.json({ error: 'insight upstream error' }, { status: 502 });
    }
  });
}
