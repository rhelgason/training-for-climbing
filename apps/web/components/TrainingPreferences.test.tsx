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

describe('TrainingPreferences — derived context', () => {
  it('shows nothing when the app has worked nothing out', async () => {
    await renderPrefs();
    expect(screen.queryByText(/What the app worked out/i)).not.toBeInTheDocument();
  });

  it('lists confirmed notes separately from what the climber wrote', async () => {
    await repo.saveProfile({
      climberContext: 'Ten years in, mostly outdoor granite.',
      derivedContext: [note('injury:finger:2026-08', 'Right ring finger sore on crimps.')],
    });
    await renderPrefs();

    expect(await screen.findByText(/What the app worked out/i)).toBeInTheDocument();
    expect(screen.getByText('Right ring finger sore on crimps.')).toBeInTheDocument();
    // The climber's own words stay in their own field, untouched.
    expect(screen.getByDisplayValue('Ten years in, mostly outdoor granite.')).toBeInTheDocument();
  });

  it('removes a note so the coach stops reading it', async () => {
    await repo.saveProfile({
      derivedContext: [
        note('injury:finger:2026-08', 'Right ring finger sore on crimps.'),
        note('injury:shoulder:2026-07', 'Left shoulder aches overhead.'),
      ],
    });
    await renderPrefs();

    const removes = await screen.findAllByRole('button', { name: /Remove/i });
    await act(async () => {
      fireEvent.click(removes[0]);
    });

    await waitFor(async () => {
      const profile = await repo.getProfile();
      expect(profile?.derivedContext).toHaveLength(1);
      // The right one went, and the other survived.
      expect(profile?.derivedContext?.[0].id).toBe('injury:shoulder:2026-07');
    });
    expect(screen.queryByText('Right ring finger sore on crimps.')).not.toBeInTheDocument();
  });

  it('hides the section once the last note is removed', async () => {
    await repo.saveProfile({
      derivedContext: [note('injury:finger:2026-08', 'Right ring finger sore on crimps.')],
    });
    await renderPrefs();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Remove/i }));
    });

    await waitFor(() =>
      expect(screen.queryByText(/What the app worked out/i)).not.toBeInTheDocument(),
    );
  });
});
