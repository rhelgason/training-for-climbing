/**
 * AI Coach client — POSTs the training context to the app's own server (the same
 * Railway service and bearer token as cloud sync) and returns the structured
 * suggestion. The server calls the LLM; the app never holds an LLM key.
 */
import type { SyncConfig } from '../sync/syncConfig';
import type { CoachContext, CoachSuggestion } from './types';

/** Thrown when the coach is unavailable (offline, not configured, rate-limited). */
export class CoachUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CoachUnavailableError';
  }
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/coach`;
}

function isCoachSuggestion(value: unknown): value is CoachSuggestion {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.headline === 'string' &&
    Array.isArray(s.plan) &&
    typeof s.rationale === 'string' &&
    Array.isArray(s.watchOuts)
  );
}

export async function requestCoachSuggestion(
  config: SyncConfig,
  context: CoachContext,
): Promise<CoachSuggestion> {
  let res: Response;
  try {
    res = await fetch(endpoint(config.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ context }),
    });
  } catch (err) {
    throw new CoachUnavailableError(`Coach request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new CoachUnavailableError(`Coach request failed (HTTP ${res.status})`, res.status);
  }

  const body = (await res.json()) as { suggestion?: unknown };
  if (!isCoachSuggestion(body.suggestion)) {
    throw new CoachUnavailableError('Coach returned an unexpected response shape');
  }
  return body.suggestion;
}
