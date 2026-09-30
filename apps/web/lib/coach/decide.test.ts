import { describe, expect, it } from 'vitest';
import { decideCoachFetch } from './decide';

const base = {
  enabled: true,
  contextKey: 'day|gym',
  autoStarted: false,
  autoFailed: false,
};

describe('decideCoachFetch', () => {
  it('reuses a suggestion generated for these exact conditions', () => {
    expect(decideCoachFetch({ ...base, cachedKey: 'day|gym' }).action).toBe('use-cache');
  });

  it('does not call again after an auto attempt failed', () => {
    expect(decideCoachFetch({ ...base, autoFailed: true }).action).toBe('skip');
  });

  it('does not start a second call while one is in flight', () => {
    expect(decideCoachFetch({ ...base, autoStarted: true }).action).toBe('skip');
  });

  it('calls when nothing is cached, and again only when the picture changes', () => {
    expect(decideCoachFetch(base)).toEqual({
      action: 'fetch',
      reason: 'no cached suggestion',
    });
    expect(decideCoachFetch({ ...base, cachedKey: 'yesterday' }).reason).toBe('conditions changed');
  });

  it('does not call when the coach is off, unless a matching cache can be shown', () => {
    expect(decideCoachFetch({ ...base, enabled: false }).action).toBe('skip');
    expect(decideCoachFetch({ ...base, enabled: false, cachedKey: 'day|gym' }).action).toBe(
      'use-cache',
    );
  });
});
