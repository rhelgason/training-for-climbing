/**
 * Whether opening Train should call the coach.
 *
 * A cached answer for this exact picture is shown as-is. A failed auto call
 * waits for the refresh button. A second mount while the first call is in
 * flight does not start another one.
 */
export function decideCoachFetch(input: {
  enabled: boolean;
  contextKey: string;
  cachedKey?: string;
  autoStarted: boolean;
  autoFailed: boolean;
}): { action: 'use-cache' | 'fetch' | 'skip'; reason: string } {
  if (input.cachedKey === input.contextKey) {
    return { action: 'use-cache', reason: 'same conditions already answered' };
  }
  if (!input.enabled) return { action: 'skip', reason: 'coach off or signed out' };
  if (input.autoFailed) {
    return { action: 'skip', reason: 'this picture already failed; waiting for a manual refresh' };
  }
  if (input.autoStarted) {
    return { action: 'skip', reason: 'call already in flight for this picture' };
  }
  return {
    action: 'fetch',
    reason: input.cachedKey ? 'conditions changed' : 'no cached suggestion',
  };
}
