/**
 * A capacity spike (503) on the last provider is worth one more try. A usage
 * limit (429, quota) is not: retrying spends the same exhausted quota.
 * Callers with another provider skip the retry and switch immediately.
 *
 * Each attempt also dies on its own timer so a hung provider cannot use the
 * whole route budget and block the next one.
 */
export const LLM_ATTEMPT_TIMEOUT_MS = 12_000;
export const LLM_RETRY_DELAYS_MS = [1000];

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

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

export async function fetchWithLlmRetries(
  url: string,
  init: RequestInit,
  toError: (status: number, detail: string) => LlmHttpError,
  options?: { retryUnavailable?: boolean; timeoutMs?: number },
): Promise<Response> {
  const retryUnavailable = options?.retryUnavailable !== false;
  const timeoutMs = options?.timeoutMs ?? LLM_ATTEMPT_TIMEOUT_MS;
  const delays = retryUnavailable ? LLM_RETRY_DELAYS_MS : [];
  let lastError: LlmHttpError | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await llmRetry.sleepMs(delays[attempt - 1]);
    try {
      const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      const detail = await res.text().catch(() => '');
      lastError = toError(res.status, detail);
      if (isUsageLimit(res.status, detail)) throw lastError;
      if (!isTransientLlmStatus(res.status) || !retryUnavailable || attempt === delays.length) {
        throw lastError;
      }
    } catch (err) {
      if (err instanceof LlmHttpError) throw err;
      if (!isTimeout(err)) throw err;
      lastError = new LlmHttpError(0, 'timeout', `LLM request timed out after ${timeoutMs}ms`);
      if (!retryUnavailable || attempt === delays.length) throw lastError;
    }
  }
  throw lastError ?? new Error('LLM request failed');
}
