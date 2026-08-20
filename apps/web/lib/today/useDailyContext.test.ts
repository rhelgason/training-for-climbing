import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { InMemoryRepository, now } from '@tfc/core';
import { useDailyContext } from './useDailyContext';

const DAY = 24 * 60 * 60 * 1000;

describe('useDailyContext', () => {
  it("falls back to the profile's usual setup when nothing is saved", async () => {
    const repo = new InMemoryRepository();
    await repo.saveProfile({ equipment: ['hangboard'], sessionLength: 'long' });

    const { result } = renderHook(() => useDailyContext(repo, 0));

    await waitFor(() => expect(result.current.value).not.toBeNull());
    expect(result.current.value?.equipment).toEqual(['hangboard']);
    expect(result.current.value?.sessionLength).toBe('long');
    expect(result.current.confirmed).toBe(false);
  });

  it("inherits yesterday's gym but not yesterday's fatigue", async () => {
    const repo = new InMemoryRepository();
    await repo.saveDailyContext({
      date: now() - DAY,
      environment: 'outdoor',
      equipment: ['outdoor-rock'],
      sessionLength: 'long',
      readiness: 'tired',
    });

    const { result } = renderHook(() => useDailyContext(repo, 0));

    await waitFor(() => expect(result.current.value).not.toBeNull());
    expect(result.current.value?.environment).toBe('outdoor');
    expect(result.current.value?.equipment).toEqual(['outdoor-rock']);
    // Readiness is the one thing that must not carry over.
    expect(result.current.value?.readiness).toBe('ok');
    expect(result.current.confirmed).toBe(false);
  });

  it('persists an edit as today’s context and marks it confirmed', async () => {
    const repo = new InMemoryRepository();
    const { result } = renderHook(() => useDailyContext(repo, 0));
    await waitFor(() => expect(result.current.value).not.toBeNull());

    act(() => {
      result.current.update({
        environment: 'indoor',
        equipment: ['boulder-wall'],
        sessionLength: 'quick',
        readiness: 'tired',
        note: '  cramped session  ',
      });
    });

    expect(result.current.confirmed).toBe(true);
    await waitFor(() => expect(result.current.record).not.toBeNull());
    const saved = await repo.getDailyContext(now());
    expect(saved?.readiness).toBe('tired');
    expect(saved?.sessionLength).toBe('quick');
    expect(saved?.note).toBe('cramped session');
  });

  it('reloads today’s saved row on a later visit', async () => {
    const repo = new InMemoryRepository();
    await repo.saveDailyContext({
      date: now(),
      environment: 'outdoor',
      equipment: ['outdoor-rock'],
      sessionLength: 'long',
      readiness: 'fresh',
    });

    const { result } = renderHook(() => useDailyContext(repo, 0));

    await waitFor(() => expect(result.current.value).not.toBeNull());
    expect(result.current.confirmed).toBe(true);
    expect(result.current.value?.readiness).toBe('fresh');
  });
});
