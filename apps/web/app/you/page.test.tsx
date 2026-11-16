import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { InMemoryRepository, now, type Repository } from '@tfc/core';
import YouPage from './page';

let repo: Repository;
vi.mock('../../lib/db/RepositoryProvider', () => ({
  useRepository: () => repo,
  useSync: () => ({ dataVersion: 0, syncing: false }),
}));

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  repo = new InMemoryRepository();
  await repo.init();
});

afterEach(cleanup);

describe('You', () => {
  it('asks for what is missing and says what it would unlock', async () => {
    render(<YouPage />);
    await waitFor(() => expect(screen.getByText(/No goal yet/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Goals.*Add one/ })).toHaveAttribute(
      'href',
      '/plan/goals/new',
    );
    expect(screen.getByText(/your plan leans\s+into it/)).toBeInTheDocument();
    expect(screen.getByText(/Picked for you/)).toBeInTheDocument();
  });

  it('summarises what is set up', async () => {
    await repo.saveGoal({ title: 'Send V7', horizon: 'medium', targetDate: now() + 41 * DAY });
    await repo.saveAssessment({
      responses: {},
      mental: 20,
      technical: 40,
      physical: 40,
      weakestArea: 'mental',
    });
    render(<YouPage />);
    await waitFor(() => expect(screen.getByText('Send V7')).toBeInTheDocument());
    expect(screen.getByText(/41 days left/)).toBeInTheDocument();
    expect(screen.getByText('Weakest area: Mental')).toBeInTheDocument();
    // A dated goal plans the season back from its deadline: taper last.
    expect(screen.getByText(/Built back from “Send V7”/)).toBeInTheDocument();
  });
});
