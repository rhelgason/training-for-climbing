import * as Crypto from 'expo-crypto';

/** Pure-JS UUID v4 fallback (used when no platform RNG is available, e.g. tests). */
function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a UUID v4. Prefers the platform's secure RNG (Web Crypto, then
 * expo-crypto) and falls back to a pure-JS implementation when neither is
 * available so the function is safe to call in any environment.
 */
export function newId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // expo-crypto not available in this environment; fall through.
  }
  return fallbackUuid();
}
