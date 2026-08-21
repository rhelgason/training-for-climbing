import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InMemoryRepository, now, type Repository } from '@tfc/core';
import TrainHome from './page';

const push = vi.fn();
const replace = vi.fn();
// One stable object: the screen's load effect lists `router` in its deps, and
// Next's real `useRouter` is referentially stable. A fresh object per render
// would re-run the effect forever.
const router = {
  push,
  back: () => {},
  replace,
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
};

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/train',
  useParams: () => ({}),
}));

/**
 * The screen normally builds its own repository from the provider. These tests
 * inject one so they can seed history and then read back what was written —
 * the point is the round trip: prescribe → confirm → recorded.
 */
let repo: Repository;
const syncState = { dataVersion: 0, syncing: false };
vi.mock('../../lib/db/RepositoryProvider', () => ({
  useRepository: () => repo,
  useSync: () => syncState,
}));

const DAY = 24 * 60 * 60 * 1000;

/** Click and let the resulting state settle (no user-event available offline). */
async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function seed(): Promise<void> {
  repo = new InMemoryRepository();
  await repo.init();
  // Onboarded, so the screen renders instead of redirecting to /welcome.
  await repo.saveProfile({
    onboardedAt: 1,
    aiCoachEnabled: false,
    daysPerWeek: 5,
    equipment: ['boulder-wall', 'rope-wall', 'hangboard', 'pull-up-bar'],
  });
  await repo.saveAssessment({
    responses: {},
    mental: 40,
    technical: 40,
    physical: 20,
    weakestArea: 'physical',
  });
}

async function renderScreen() {
  render(<TrainHome />);
  await waitFor(() => expect(screen.getByText("Today's plan")).toBeInTheDocument());
}

beforeEach(async () => {
  push.mockClear();
  replace.mockClear();
  window.localStorage.clear();
  await seed();
});

afterEach(cleanup);

describe('TrainHome — logging the day', () => {
  it('records the prescribed focus, so tomorrow can honour recovery gaps', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /I did this/i }));

    await waitFor(async () => {
      const journals = await repo.listJournals();
      expect(journals).toHaveLength(1);
      // Recorded, not inferred — this is what the scheduler trusts.
      expect(journals[0].focus?.length).toBeGreaterThan(0);
    });
  });

  it('records unticked steps as skipped rather than losing them', async () => {
    await renderScreen();
    // Untick the warm-up (always the first step of a training plan).
    const steps = screen.getAllByRole('button', { pressed: true });
    await click(steps[0]);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Log it — \d+ of \d+ done/ })).toBeInTheDocument(),
    );
    await click(screen.getByRole('button', { name: /Log it —/ }));

    await waitFor(async () => {
      const [journal] = await repo.listJournals();
      expect(journal.skipped?.length).toBe(1);
    });
  });

  it('opens the log afterwards so the free text can be added', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /I did this/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/train\/journal\//)),
    );
  });

  it('edits the day’s existing entry instead of creating a second', async () => {
    await repo.saveJournal({ date: now(), activities: ['climbing'] });
    await renderScreen();
    await click(screen.getByRole('button', { name: /I did this/i }));

    await waitFor(async () => {
      expect((await repo.listJournals())[0].focus?.length).toBeGreaterThan(0);
    });
    expect(await repo.listJournals()).toHaveLength(1);
  });
});

describe('TrainHome — the daily check-in', () => {
  it('assumes a context until the climber confirms one', async () => {
    await renderScreen();
    expect(screen.getByText(/assumed/)).toBeInTheDocument();
  });

  it('rebuilds the plan when readiness changes, and persists the answer', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Change/ }));
    await click(screen.getByRole('button', { name: 'Something hurts' }));

    // "Something hurts" is a recovery verdict: the plan must become a rest day.
    await waitFor(() => expect(screen.getByText('Take a rest day')).toBeInTheDocument());
    await waitFor(async () => {
      expect((await repo.getDailyContext(now()))?.readiness).toBe('tweaky');
    });
  });

  it('drops equipment-gated work when today’s gear says so', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Change/ }));
    // Turn everything off, leaving only bodyweight work possible.
    for (const label of [
      'Bouldering wall',
      'Rope wall (lead / top-rope)',
      'Hangboard',
      'Pull-up bar',
    ]) {
      await click(screen.getByRole('button', { name: label, pressed: true }));
    }
    // Close the panel, or its own chip labels satisfy the assertion below.
    await click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      const plan = screen.getByText("Today's plan").closest('div')?.parentElement;
      expect(plan?.textContent ?? '').not.toMatch(/hangboard|fingerboard|campus|pull-up/i);
    });
  });
});

describe('TrainHome — recovery is visible', () => {
  it('rests and explains itself after three hard days', async () => {
    for (const offset of [1, 2, 3]) {
      await repo.saveJournal({
        date: now() - offset * DAY,
        activities: ['climbing'],
        intensity: 'hard',
        focus: ['maxStrength'],
      });
    }
    render(<TrainHome />);
    await waitFor(() => expect(screen.getByText('Take a rest day')).toBeInTheDocument());
    expect(screen.getByText(/3 days running/)).toBeInTheDocument();
  });

  it('names yesterday’s session in the why panel', async () => {
    await repo.saveJournal({
      date: now() - DAY,
      activities: ['fingerboard'],
      intensity: 'hard',
      focus: ['maxStrength'],
    });
    await renderScreen();
    await click(screen.getByRole('button', { name: /Why this plan/i }));
    expect(screen.getByText(/Yesterday: max strength/)).toBeInTheDocument();
    expect(screen.getByText(/48 hours/)).toBeInTheDocument();
  });
});
