/**
 * Transient Gemini/Groq failures (429, 503) are usually a short spike, not a
 * broken key. Retry a few times with backoff so a burst of demand doesn't
 * drop the climber onto the deterministic plan.
 *
 * Delays total ~12s across three retries, well inside the 60s route budget.
 */
export const LLM_RETRY_DELAYS_MS = [1000, 3000, 8000];

export const llmRetry = {
  sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

export function isTransientLlmStatus(status: number): boolean {
  return status === 429 || status === 503;
}

export async function fetchWithLlmRetries(
  url: string,
  init: RequestInit,
  toError: (status: number, detail: string) => Error,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= LLM_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await llmRetry.sleepMs(LLM_RETRY_DELAYS_MS[attempt - 1]);
    const res = await fetch(url, init);
    if (res.ok) return res;
    const detail = await res.text().catch(() => '');
    lastError = toError(res.status, detail);
    if (!isTransientLlmStatus(res.status)) throw lastError;
  }
  throw lastError ?? new Error('LLM request failed');
}
