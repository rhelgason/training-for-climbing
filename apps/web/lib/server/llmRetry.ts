/**
 * A capacity spike (503) is worth one more try. A usage limit (429, quota)
 * is not: retrying spends the same exhausted quota and is how a few refreshes
 * became "you have exceeded your quota". Callers with another provider skip
 * the 503 retries and switch immediately.
 *
 * Delays total ~12s across three retries, well inside the 60s route budget.
 */
export const LLM_RETRY_DELAYS_MS = [1000, 3000, 8000];

export const llmRetry = {
  sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

export class LlmHttpError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string, message: string) {
    super(message);
    this.name = 'LlmHttpError';
    this.status = status;
    this.detail = detail;
  }
}

/** Quota / rate limit. Another call to the same provider will not succeed. */
export function isUsageLimit(status: number, detail: string): boolean {
  if (status === 429) return true;
  return /quota|resource_exhausted|rate[-_ ]?limit|exceeded your (current )?quota|usage limit/i.test(
    detail,
  );
}

export function isTransientLlmStatus(status: number): boolean {
  return status === 503;
}

export async function fetchWithLlmRetries(
  url: string,
  init: RequestInit,
  toError: (status: number, detail: string) => LlmHttpError,
  options?: { retryUnavailable?: boolean },
): Promise<Response> {
  const retryUnavailable = options?.retryUnavailable !== false;
  const delays = retryUnavailable ? LLM_RETRY_DELAYS_MS : [];
  let lastError: LlmHttpError | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await llmRetry.sleepMs(delays[attempt - 1]);
    const res = await fetch(url, init);
    if (res.ok) return res;
    const detail = await res.text().catch(() => '');
    lastError = toError(res.status, detail);
    if (isUsageLimit(res.status, detail)) throw lastError;
    if (!isTransientLlmStatus(res.status) || !retryUnavailable) throw lastError;
  }
  throw lastError ?? new Error('LLM request failed');
}
