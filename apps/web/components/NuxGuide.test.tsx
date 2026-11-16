import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRepository, now, type Repository } from '@tfc/core';
import { NuxGuide } from './NuxGuide';

const replace = vi.fn();
let pathname = '/train';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));

let repo: Repository;
vi.mock('../lib/db/RepositoryProvider', () => ({
  useRepository: () => repo,
  useSync: () => ({ dataVersion: 0, localVersion: 0 }),
}));

const DAY = 24 * 60 * 60 * 1000;

async function assessed() {
  await repo.saveAssessment({
    responses: {},
    mental: 40,
    technical: 40,
    physical: 20,
    weakestArea: 'physical',
  });
}

beforeEach(async () => {
  replace.mockClear();
  pathname = '/train';
  repo = new InMemoryRepository();
  await repo.init();
  await repo.saveProfile({ onboardedAt: now() });
});

afterEach(cleanup);

describe('NuxGuide', () => {
  it('starts a new climber on the self-assessment, pointing at You', async () => {
    render(<NuxGuide />);
    await waitFor(() => expect(screen.getByText(/Getting started · 1 of 4/)).toBeInTheDocument());
    expect(screen.getByText(/Tap You/)).toBeInTheDocument();
  });

  it('sends a stray route back to the step they are on', async () => {
    pathname = '/progress';
    render(<NuxGuide />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/you'));
  });

  it('picks up at the goal once the assessment is done', async () => {
    await assessed();
    pathname = '/you';
    render(<NuxGuide />);
    await waitFor(() => expect(screen.getByText(/2 of 4/)).toBeInTheDocument());
    expect(screen.getByText(/set a goal/i)).toBeInTheDocument();
  });

  it('lets them read their results after the assessment moves them on', async () => {
    await assessed();
    pathname = '/assess/results/abc';
    render(<NuxGuide />);
    await waitFor(() => expect(screen.getByText(/Tap Done/)).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it('finishes on the plan, and stays finished', async () => {
    await assessed();
    await repo.saveGoal({ title: 'Send V7', horizon: 'medium' });
    await repo.saveDailyContext({
      date: now(),
      environment: 'indoor',
      equipment: ['boulder-wall'],
      sessionLength: 'standard',
      readiness: 'ok',
    });
    render(<NuxGuide />);
    await waitFor(() => expect(screen.getByText(/4 of 4/)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /let’s train/ }));
    });
    expect(screen.queryByText(/Getting started/)).not.toBeInTheDocument();
    expect((await repo.getProfile())?.nuxCompletedAt).toBeGreaterThan(0);
  });

  it('never interrupts an account that was already training here', async () => {
    await repo.saveJournal({ date: now() - 10 * DAY, activities: ['climbing'] });
    pathname = '/progress';
    render(<NuxGuide />);
    await waitFor(async () => expect((await repo.getProfile())?.nuxCompletedAt).toBeDefined());
    expect(screen.queryByText(/Getting started/)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('leaves sign-up alone', async () => {
    pathname = '/welcome';
    render(<NuxGuide />);
    await act(async () => {});
    expect(screen.queryByText(/Getting started/)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
