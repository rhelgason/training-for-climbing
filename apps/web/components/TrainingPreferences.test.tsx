import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InMemoryRepository, type Repository } from '@tfc/core';
import { TrainingPreferences } from './TrainingPreferences';

let repo: Repository;
const syncState = { dataVersion: 0, syncing: false };
vi.mock('../lib/db/RepositoryProvider', () => ({
  useRepository: () => repo,
  useSync: () => syncState,
}));

beforeEach(async () => {
  repo = new InMemoryRepository();
  await repo.init();
});
afterEach(cleanup);

async function renderPrefs() {
  render(<TrainingPreferences />);
  await waitFor(() => expect(screen.getByText('Ability tier')).toBeInTheDocument());
}

const note = (id: string, text: string) => ({
  id,
  text,
  source: 'journal-scan' as const,
  addedAt: Date.UTC(2026, 7, 20),
});

describe('TrainingPreferences — how hard to push', () => {
  it('defaults an existing profile to full-time and can switch to steady', async () => {
    await repo.saveProfile({ daysPerWeek: 4 });
    await renderPrefs();

    expect(screen.getByRole('button', { name: 'Full-time', pressed: true })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Steady' }));
    });
    await waitFor(async () => {
      expect((await repo.getProfile())?.trainingPush).toBe('steady');
    });
  });
});

describe('TrainingPreferences — no injury list', () => {
  it('never lists injury notes saved by older versions of the app', async () => {
    await repo.saveProfile({
      derivedContext: [note('injury:finger:2026-08', 'Right ring finger sore on crimps.')],
    });
    await renderPrefs();
    expect(screen.queryByText('Right ring finger sore on crimps.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
  });
});
