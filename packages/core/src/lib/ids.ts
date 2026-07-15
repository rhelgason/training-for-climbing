/** Pure-JS UUID v4 fallback (used when no platform RNG is available, e.g. tests). */
function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a UUID v4. Prefers the platform's secure RNG (Web Crypto) and falls
 * back to a pure-JS implementation when it is unavailable so the function is safe
 * to call in any environment (browser, Node, tests).
 */
export function newId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  return fallbackUuid();
}
