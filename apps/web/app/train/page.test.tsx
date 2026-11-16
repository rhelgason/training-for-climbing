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

/**
 * Records what the screen asks the coach hook for. The coach is off in these
 * tests anyway; what matters is *when* a context key reaches it.
 */
const coachCalls = vi.hoisted(() => vi.fn());
vi.mock('../../lib/coach/useCoach', () => ({
  useCoach: (...args: unknown[]) => {
    coachCalls(...args);
    return {
      suggestion: null,
      generatedAt: null,
      status: 'idle',
      enabled: false,
      errorMessage: null,
      refresh: () => {},
    };
  },
}));

/** The context key and options of the newest render's coach request. */
function lastCoachAsk(): { key: string | undefined; auto: boolean } {
  const [, key, options] = coachCalls.mock.calls.at(-1) ?? [];
  return { key, auto: (options as { auto?: boolean } | undefined)?.auto ?? true };
}

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
  coachCalls.mockClear();
  // jsdom has no layout; the run scrolls each new step into view.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.localStorage.clear();
  await seed();
});

afterEach(cleanup);

describe('TrainHome — logging the day', () => {
  it('records the prescribed focus, so tomorrow can honour recovery gaps', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Already done\? Log it/ }));

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
      expect(screen.getByRole('button', { name: /Log it — \d+ of \d+/ })).toBeInTheDocument(),
    );
    await click(screen.getByRole('button', { name: /Log it —/ }));

    await waitFor(async () => {
      const [journal] = await repo.listJournals();
      expect(journal.skipped?.length).toBe(1);
    });
  });

  it('debriefs in place: effort and a sentence, then a look at tomorrow', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Already done\? Log it/ }));
    await waitFor(() => expect(screen.getByText('Done for today ✓')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Already done\? Log it/ })).not.toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Hard' }));
    fireEvent.change(screen.getByPlaceholderText(/Tomorrow's plan reads this/), {
      target: { value: 'Left ring finger tweaky on crimps' },
    });
    await click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const [journal] = await repo.listJournals();
      expect(journal.summary).toBe('Left ring finger tweaky on crimps');
      expect(journal.intensity).toBe('hard');
    });
    expect(await screen.findByText('Left ring finger tweaky on crimps')).toBeInTheDocument();
  });

  it('keeps the day logged when a second session is added by hand', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Already done\? Log it/ }));
    await waitFor(() => expect(screen.getByText('Done for today ✓')).toBeInTheDocument());
    await repo.saveJournal({ date: now(), activities: ['cardio'], summary: 'Evening run' });
    cleanup();

    await renderScreen();
    expect(screen.getByText('Done for today ✓')).toBeInTheDocument();
    await waitFor(() => expect(lastCoachAsk().auto).toBe(false));
  });

  it('edits the day’s existing entry instead of creating a second', async () => {
    await repo.saveJournal({ date: now(), activities: ['climbing'] });
    await renderScreen();
    await click(screen.getByRole('button', { name: /Already done\? Log it/ }));

    await waitFor(async () => {
      expect((await repo.listJournals())[0].focus?.length).toBeGreaterThan(0);
    });
    expect(await repo.listJournals()).toHaveLength(1);
  });
});

describe('TrainHome — the guided session', () => {
  /** Walk to the end of the run, tapping Done (or Skip on the steps listed). */
  async function walk(skip: number[] = []) {
    for (let i = 0; i < 20; i++) {
      const finish = screen.queryByRole('button', { name: 'Done — finish session' });
      if (skip.includes(i)) await click(screen.getByRole('button', { name: 'Skip' }));
      else await click(finish ?? screen.getByRole('button', { name: 'Done — next' }));
      if (finish) return;
    }
    throw new Error('run never finished');
  }

  it('walks the plan one step at a time, records skips, and ends in the debrief', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: 'This is right' }));
    await click(screen.getByRole('button', { name: '▶ Start session' }));
    expect(screen.getByText(/^Step 1 of \d+$/)).toBeInTheDocument();
    const first = screen
      .getByText(/^Step 1 of/)
      .closest('div')!
      .parentElement!.querySelector('p.text-base')!.textContent;

    await click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText(/^Step 2 of/)).toBeInTheDocument();
    await walk();

    await waitFor(() => expect(screen.getByText('Done for today ✓')).toBeInTheDocument());
    const [journal] = await repo.listJournals();
    expect(journal.skipped).toEqual([first]);
    expect(journal.focus?.length).toBeGreaterThan(0);
  });

  it('pauses and resumes at the same step, even after the app is closed', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: '▶ Start session' }));
    await click(screen.getByRole('button', { name: 'Done — next' }));
    await click(screen.getByRole('button', { name: '⏸ Pause' }));
    expect(screen.getByRole('button', { name: /Resume session — step 2 of/ })).toBeInTheDocument();

    cleanup();
    await renderScreen();
    await click(screen.getByRole('button', { name: /Resume session — step 2 of/ }));
    expect(screen.getByText(/^Step 2 of/)).toBeInTheDocument();
  });
});

describe('TrainHome — the daily check-in', () => {
  it('assumes a context until the climber confirms one', async () => {
    await renderScreen();
    expect(screen.getByText(/not confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/coach does not run until you confirm/i)).toBeInTheDocument();
  });

  it('rebuilds the plan when readiness changes, and persists the answer', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: /Change/ }));
    await click(screen.getByRole('button', { name: 'Something hurts' }));
    await click(screen.getByRole('button', { name: 'Done' }));

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

describe('TrainHome — tied back to what they set up', () => {
  it('reminds them of the goal with the nearest deadline', async () => {
    await repo.saveGoal({ title: 'Send V7', horizon: 'medium', targetDate: now() + 41 * DAY });
    await renderScreen();
    expect(screen.getByText('Remember: Send V7 — 41 days left')).toBeInTheDocument();
  });

  it('asks whether a lapsed goal was met, then asks for the next one', async () => {
    await repo.saveGoal({ title: 'Send V7', horizon: 'medium', targetDate: now() - 2 * DAY });
    await renderScreen();
    expect(screen.getByText('Deadline passed')).toBeInTheDocument();

    await click(screen.getByRole('button', { name: /Yes, done/ }));
    await waitFor(async () => expect((await repo.listGoals())[0].status).toBe('done'));
    expect(await screen.findByText(/What.s next\?/)).toBeInTheDocument();
  });

  it('extends a lapsed goal by a third of the time it was first given', async () => {
    // Set 92 days ago for a 90-day window: another month.
    await repo.saveGoal({
      title: 'Send V7',
      horizon: 'medium',
      createdAt: now() - 92 * DAY,
      targetDate: now() - 2 * DAY,
    });
    await renderScreen();
    await click(screen.getByRole('button', { name: 'Extend 1 month' }));
    await waitFor(async () => {
      const target = (await repo.listGoals())[0].targetDate!;
      expect(target).toBeGreaterThan(now() + 29 * DAY);
      expect(target).toBeLessThan(now() + 31 * DAY);
    });
    await waitFor(() => expect(screen.queryByText('Deadline passed')).not.toBeInTheDocument());
  });

  it('asks for a reassessment once the last one is three months old', async () => {
    await renderScreen();
    expect(screen.queryByText('Time to reassess')).not.toBeInTheDocument();
    cleanup();

    repo = new InMemoryRepository();
    await repo.init();
    await repo.saveProfile({ onboardedAt: 1, aiCoachEnabled: false });
    await repo.saveAssessment({
      responses: {},
      mental: 40,
      technical: 40,
      physical: 20,
      weakestArea: 'physical',
      createdAt: now() - 90 * DAY,
    });
    await renderScreen();
    expect(screen.getByText('Time to reassess').closest('a')).toHaveAttribute(
      'href',
      '/assess/new',
    );
  });
});

describe('TrainHome — when the coach is asked', () => {
  it('asks nothing while the check-in is being filled in, then once on Done', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: 'Change' }));
    await click(screen.getByRole('button', { name: 'Fresh' }));
    await click(screen.getByRole('button', { name: '2+ hours' }));
    expect(lastCoachAsk().key).toBeUndefined();

    await click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(lastCoachAsk().key).toMatch(/\|fresh\|/));
    const keys = new Set(coachCalls.mock.calls.map(([, key]) => key).filter(Boolean));
    expect(keys.size).toBe(1);
  });

  it('stops asking once today is logged', async () => {
    await renderScreen();
    await click(screen.getByRole('button', { name: 'This is right' }));
    await waitFor(() => expect(lastCoachAsk().key).toBeDefined());
    expect(lastCoachAsk().auto).toBe(true);

    await click(screen.getByRole('button', { name: /Already done\? Log it/ }));
    cleanup();
    await renderScreen();
    await waitFor(() => expect(lastCoachAsk().auto).toBe(false));
  });
});

describe('TrainHome — recovery is visible', () => {
  it('leaves the wall after three finger days and still gives a session', async () => {
    for (const offset of [1, 2, 3]) {
      await repo.saveJournal({
        date: now() - offset * DAY,
        activities: ['climbing'],
        intensity: 'hard',
        focus: ['maxStrength'],
      });
    }
    render(<TrainHome />);
    await waitFor(() => expect(screen.getByText('Off the fingers')).toBeInTheDocument());
    expect(screen.getByText(/lifting, easy cardio, and stretching/i)).toBeInTheDocument();
    expect(screen.getByText(/reverse wrist curls/i)).toBeInTheDocument();
    expect(screen.queryByText('Take a rest day')).not.toBeInTheDocument();
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

describe('TrainHome — what to climb', () => {
  it('names the grade bands once there are enough sends to pitch against', async () => {
    for (const daysAgo of [4, 9, 15]) {
      await repo.saveClimb({
        date: now() - daysAgo * DAY,
        environment: 'indoor',
        discipline: 'boulder',
        grade: 'V4',
        outcome: 'send',
      });
    }
    await renderScreen();

    expect(await screen.findByText('What to climb')).toBeInTheDocument();
    // Anchored on the consolidated V4: work is one above it.
    expect(screen.getByText(/work V5/)).toBeInTheDocument();
    expect(screen.getByText(/3 sends in the last 6 months/i)).toBeInTheDocument();
  });

  it('says it has nothing to go on rather than inventing a grade', async () => {
    await renderScreen();
    expect(await screen.findByText('What to climb')).toBeInTheDocument();
    expect(screen.getByText(/no sends logged yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/work V/)).not.toBeInTheDocument();
  });
});

describe('TrainHome — prescribed numbers', () => {
  /**
   * Which exercise the scheduler rotates to depends on the day, so these pin
   * the clock. Without it the fingerboard step appears only on some real-world
   * dates and the assertions would quietly match nothing.
   */
  beforeEach(() => {
    // Only Date — faking the timer functions too would stall waitFor and the
    // IndexedDB shim, which both need the real event loop.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('makes the first session the test before it will name a weight', async () => {
    await renderScreen();
    expect(screen.getByText(/Max-weight hangs/)).toHaveTextContent(/Today finds your number/);
    expect(
      screen.getByRole('link', { name: /Start Max-weight hangs \(10 s\): test/ }),
    ).toHaveAttribute('href', '/train/session/max-hang-10');
  });

  it('starts from an older benchmark and says where the number came from', async () => {
    await repo.saveBenchmark({
      testId: 'protocol-max-weight-hang',
      value: 40,
      date: now() - 5 * DAY,
    });
    await repo.saveBenchmark({
      testId: 'protocol-max-weight-hang',
      value: 38,
      date: now() - 12 * DAY,
    });
    await renderScreen();

    expect(screen.getByText(/Max-weight hangs/)).toHaveTextContent('+40 lb');
    expect(screen.getByText(/Your last max-weight hangs was \+40 lb/)).toBeInTheDocument();
  });

  it('progresses off the logged sets', async () => {
    const date = now() - 8 * DAY;
    await repo.saveExerciseLog({
      date,
      workoutId: 'max-hang-10',
      edgeMm: 20,
      sets: [1, 2, 3].map(() => ({ loadLb: 25, rpe: 8, completed: true, reps: 5 })),
    });
    await renderScreen();

    expect(screen.getByText(/Max-weight hangs/)).toHaveTextContent(
      /^Max strength — Max-weight hangs \(10 s\): \+30 lb/,
    );
    expect(screen.getByText(/Max-weight hangs/)).toHaveTextContent(
      /Last time \(8 days ago\): \+25 lb/,
    );
    expect(
      screen.getByRole('link', { name: /Start Max-weight hangs \(10 s\): \+30 lb/ }),
    ).toBeInTheDocument();
  });

  it('shows a workout logged today in place of its start button', async () => {
    await repo.saveExerciseLog({
      date: now(),
      workoutId: 'max-hang-10',
      edgeMm: 20,
      sets: [{ loadLb: 0, rpe: 9, completed: true, reps: 5 }],
    });
    await renderScreen();

    expect(screen.getByRole('link', { name: /✓ bodyweight on 20 mm/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Start Max-weight hangs/ })).not.toBeInTheDocument();
  });
});

describe('TrainHome — profile drift', () => {
  /** Enough consolidated sends at V4 to imply the intermediate tier. */
  async function seedOutgrownProfile() {
    await repo.saveProfile({ abilityTier: 'beginner', defaultDiscipline: 'boulder' });
    for (const daysAgo of [4, 9, 15]) {
      await repo.saveClimb({
        date: now() - daysAgo * DAY,
        environment: 'indoor',
        discipline: 'boulder',
        grade: 'V4',
        outcome: 'send',
      });
    }
  }

  it('offers to update a profile the climber has outgrown', async () => {
    await seedOutgrownProfile();
    await renderScreen();

    expect(await screen.findByText(/Move your ability tier to Intermediate/i)).toBeInTheDocument();
    // The evidence, not just the verdict.
    expect(screen.getByText(/sent V4 3 times/i)).toBeInTheDocument();
  });

  it('applies the change on accept and stops asking', async () => {
    await seedOutgrownProfile();
    await renderScreen();

    await click(await screen.findByRole('button', { name: /Update my profile/i }));

    await waitFor(async () => {
      const profile = await repo.getProfile();
      expect(profile?.abilityTier).toBe('intermediate');
      expect(profile?.dismissedInsights).toContain('ability-tier:intermediate');
    });
    expect(screen.queryByText(/Move your ability tier/i)).not.toBeInTheDocument();
  });

  it('changes nothing on decline, and does not ask again', async () => {
    await seedOutgrownProfile();
    await renderScreen();

    await click(await screen.findByRole('button', { name: /Not right/i }));

    await waitFor(async () => {
      const profile = await repo.getProfile();
      // Declining is a real answer: the tier stays put but the card is retired.
      expect(profile?.abilityTier).toBe('beginner');
      expect(profile?.dismissedInsights).toContain('ability-tier:intermediate');
    });
    expect(screen.queryByText(/Move your ability tier/i)).not.toBeInTheDocument();
  });

  it('says nothing when the profile already matches the climbing', async () => {
    await repo.saveProfile({ abilityTier: 'intermediate', defaultDiscipline: 'boulder' });
    for (const daysAgo of [4, 9, 15]) {
      await repo.saveClimb({
        date: now() - daysAgo * DAY,
        environment: 'indoor',
        discipline: 'boulder',
        grade: 'V4',
        outcome: 'send',
      });
    }
    await renderScreen();
    expect(screen.queryByText(/Move your ability tier/i)).not.toBeInTheDocument();
  });
});
