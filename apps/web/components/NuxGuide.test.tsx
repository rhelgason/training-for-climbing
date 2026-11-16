import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRepository, now, type Repository } from '@tfc/core';
import { useState } from 'react';
import { NuxGuide } from './NuxGuide';
import { TodayContext, type TodayContextValue } from './TodayContext';

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

/** jsdom lays nothing out; give every element a box so the guide can see it. */
function withLayout() {
  const rects = vi
    .spyOn(HTMLElement.prototype, 'getClientRects')
    .mockReturnValue([{}] as unknown as DOMRectList);
  const box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 100,
    left: 10,
    bottom: 140,
    right: 110,
    width: 100,
    height: 40,
    x: 10,
    y: 100,
    toJSON: () => ({}),
  });
  return () => {
    rects.mockRestore();
    box.mockRestore();
  };
}

async function checkinStep() {
  await assessed();
  await repo.saveGoal({ title: 'Send V7', horizon: 'medium' });
}

const DAY_VALUE: TodayContextValue = {
  environment: 'indoor',
  equipment: ['boulder-wall'],
  sessionLength: 'standard',
  readiness: 'ok',
};

function CheckIn() {
  const [value, setValue] = useState(DAY_VALUE);
  return <TodayContext value={value} onChange={setValue} onConfirm={() => {}} confirmed={false} />;
}

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
    await waitFor(() => expect(screen.getByText(/tap Done/)).toBeInTheDocument());
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

  it('only lets the ringed thing be tapped', async () => {
    const restore = withLayout();
    const you = vi.fn();
    const other = vi.fn();
    render(
      <>
        <button type="button" data-nux="tab-/you" onClick={you}>
          You
        </button>
        <button type="button" onClick={other}>
          Progress
        </button>
        <NuxGuide />
      </>,
    );
    await waitFor(() => expect(screen.getByText(/Tap You/)).toBeInTheDocument());
    await waitFor(() => expect(document.querySelector('.nux-ring')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }));
    expect(other).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'You' }));
    expect(you).toHaveBeenCalled();
    restore();
  });

  it('walks the check-in: open it, write a line, then Done', async () => {
    const restore = withLayout();
    await checkinStep();
    render(
      <>
        <CheckIn />
        <NuxGuide />
      </>,
    );
    await waitFor(() => expect(screen.getByText(/Tap Change/)).toBeInTheDocument());
    // "This is right" would skip the look-over; only Change works.
    expect(screen.getByRole('button', { name: 'This is right' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(screen.getByText(/write a line about today/)).toBeInTheDocument());

    // Done does nothing until there's a note.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByPlaceholderText(/slept badly/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/slept badly/), {
      target: { value: 'Slept six hours, fingers fine' },
    });
    await waitFor(() => expect(screen.getByText(/Now tap Done/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByPlaceholderText(/slept badly/)).not.toBeInTheDocument();
    restore();
  });

  it('waits for the coach before showing the plan', async () => {
    const restore = withLayout();
    await checkinStep();
    await repo.saveDailyContext({ date: now(), ...DAY_VALUE });
    const { rerender } = render(
      <>
        <div data-nux="coach-writing">writing…</div>
        <NuxGuide />
      </>,
    );
    await waitFor(() => expect(screen.getByText(/writing today’s plan/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /let’s train/ })).not.toBeInTheDocument();

    rerender(
      <>
        <h2 data-nux="plan">Power endurance</h2>
        <NuxGuide />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /let’s train/ })).toBeInTheDocument(),
    );
    restore();
  });

  it('offers another goal after the first, without forcing it', async () => {
    await checkinStep();
    pathname = '/plan/goals';
    render(<NuxGuide />);
    await waitFor(() => expect(screen.getByText(/Add another goal/)).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
});
