import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InMemoryRepository, now, type Repository } from '@tfc/core';
import { SessionRunner } from './SessionRunner';

const router = { push: vi.fn(), back: () => {}, replace: () => {}, refresh: () => {} };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let repo: Repository;
vi.mock('../../lib/db/RepositoryProvider', () => ({ useRepository: () => repo }));

const DAY = 24 * 60 * 60 * 1000;

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

beforeEach(async () => {
  repo = new InMemoryRepository();
  await repo.init();
});
afterEach(cleanup);

describe('SessionRunner', () => {
  it('shows last time, today, and the book protocol before starting', async () => {
    await repo.saveExerciseLog({
      date: now() - 3 * DAY,
      workoutId: 'max-hang-7-53',
      edgeMm: 18,
      sets: [1, 2].map(() => ({ loadLb: 40, rpe: 8, completed: true, reps: 3 })),
    });
    render(<SessionRunner workoutId="max-hang-7-53" />);

    expect(await screen.findByText('Today — up a step')).toBeInTheDocument();
    expect(
      screen.getByText(/^\+45 lb · 18 mm half crimp · 2 × 3 × 7 s on \/ 53 s off$/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last time \(3 days ago\): \+40 lb on 18 mm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with timer' })).toBeInTheDocument();
  });

  it('logs sets without the timer, saves them, and says what next time asks for', async () => {
    render(<SessionRunner workoutId="max-hang-10" />);
    await click(await screen.findByRole('button', { name: 'Log without the timer' }));

    // Two sets by default (the bottom of the book range): rate both clean at 8.
    for (const group of screen.getAllByText('RPE')) {
      const chips = group.parentElement!;
      await click(Array.from(chips.querySelectorAll('button')).find((b) => b.textContent === '8')!);
    }
    await click(screen.getByRole('button', { name: 'Save 2 sets' }));

    expect(await screen.findByText('Logged')).toBeInTheDocument();
    expect(
      screen.getByText('+5 lb · 20 mm half crimp · 2 × 5 × 10 s on / 180 s off'),
    ).toBeInTheDocument();

    const [saved] = await repo.listExerciseLogs();
    expect(saved.workoutId).toBe('max-hang-10');
    expect(saved.sets).toHaveLength(2);
    expect(saved.sets.every((s) => s.completed && s.rpe === 8 && s.reps === 5)).toBe(true);
    // The top clean load also goes to the benchmark that trend charts read.
    await waitFor(async () => {
      const benchmarks = await repo.listBenchmarks();
      expect(benchmarks.find((b) => b.testId === 'protocol-max-weight-hang')?.value).toBe(0);
    });
  });

  it('records how many hangs went on a failed set', async () => {
    render(<SessionRunner workoutId="max-hang-10" />);
    await click(await screen.findByRole('button', { name: 'Log without the timer' }));
    await click(screen.getAllByRole('button', { name: '✕ Failed' })[0]);
    await click(screen.getByRole('button', { name: '3' }));
    await click(screen.getByRole('button', { name: 'Save 2 sets' }));

    await screen.findByText('Logged');
    const [saved] = await repo.listExerciseLogs();
    expect(saved.sets[0]).toMatchObject({ completed: false, reps: 3 });
  });
});
