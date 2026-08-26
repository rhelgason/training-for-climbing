/**
 * Journal-scan client — asks the app's own server whether the climber's recent
 * free text mentions a physical problem they never put in their profile.
 *
 * Same shape and same bearer token as the coach client; the server holds the
 * LLM key. The reply is turned into `Insight` proposals here rather than on the
 * server so the id scheme — which is what makes a dismissal stick — lives next
 * to the code that consumes it.
 */
import type { SyncConfig } from '../sync/syncConfig';
import type { JournalEntry } from '../../db/types';
import type { Insight } from './insights';

/** Thrown when the scan is unavailable (offline, not configured, rate-limited). */
export class InsightsUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'InsightsUnavailableError';
  }
}

interface Finding {
  note: string;
  evidence: string;
  bodyPart: string;
}

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return typeof f.note === 'string' && typeof f.bodyPart === 'string';
}

/**
 * One id per body part per month.
 *
 * Not per scan: the same sore finger would otherwise generate a fresh proposal
 * every week and the card would never stop coming back. Not permanent either —
 * if the same part flares up again months later, that's genuinely worth asking
 * about a second time.
 */
function insightId(bodyPart: string, detectedAt: number): string {
  const d = new Date(detectedAt);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `injury:${bodyPart}:${month}`;
}

export async function requestJournalInsights(
  config: SyncConfig,
  journals: JournalEntry[],
  nowMs: number,
): Promise<Insight[]> {
  let res: Response;
  try {
    res = await fetch(`${config.url.replace(/\/+$/, '')}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ journals, nowMs }),
    });
  } catch (err) {
    throw new InsightsUnavailableError(`Insight request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new InsightsUnavailableError(`Insight request failed (HTTP ${res.status})`, res.status);
  }

  const body = (await res.json()) as { findings?: unknown };
  if (!Array.isArray(body.findings)) return [];

  return body.findings.filter(isFinding).map((f) => ({
    id: insightId(f.bodyPart, nowMs),
    kind: 'injury' as const,
    title: 'Should the coach know about this?',
    // The climber's own words back to them — the check is "did I say that?",
    // which they can answer instantly, rather than "is this diagnosis right?".
    detail: f.evidence ? `${f.note} You wrote: "${f.evidence}"` : f.note,
    source: 'journal-scan' as const,
    detectedAt: nowMs,
    proposedNote: f.note,
  }));
}
