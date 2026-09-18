import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InMemoryRepository, type Repository } from '@tfc/core';
import Welcome from './page';

const replace = vi.fn();
const router = {
  push: vi.fn(),
  back: () => {},
  replace,
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
};

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/welcome',
  useParams: () => ({}),
}));

const login = vi.fn();
const runSync = vi.fn().mockResolvedValue(undefined);

vi.mock('@tfc/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tfc/core')>();
  return {
    ...actual,
    login: (...args: unknown[]) => login(...args),
    runSync: (...args: unknown[]) => runSync(...args),
  };
});

let repo: Repository;

vi.mock('../../lib/db/RepositoryProvider', () => ({
  useRepository: () => repo,
}));

/** Node 26's jsdom run here has no window.localStorage unless this is set. */
function ensureLocalStorage(): void {
  if (typeof window === 'undefined' || window.localStorage) return;
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    },
  });
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

beforeEach(async () => {
  replace.mockClear();
  login.mockReset();
  runSync.mockClear();
  ensureLocalStorage();
  window.localStorage.clear();
  repo = new InMemoryRepository();
  await repo.init();
});

afterEach(cleanup);

describe('Welcome', () => {
  it('skips About you after signing in to an account that already has a profile', async () => {
    await repo.saveProfile({ onboardedAt: 1 });
    login.mockResolvedValue({
      token: 'tok',
      user: { id: 'u1', username: 'ryan', email: null },
    });

    render(<Welcome />);
    await click(screen.getByRole('button', { name: /I already have an account/i }));
    fireEvent.change(screen.getByPlaceholderText(/username or email/i), {
      target: { value: 'ryan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/At least 8 characters/i), {
      target: { value: 'password1' },
    });
    await click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/train'));
    expect(screen.queryByText('About you')).not.toBeInTheDocument();
  });

  it('still asks About you when the account is brand new', async () => {
    login.mockResolvedValue({
      token: 'tok',
      user: { id: 'u1', username: 'new', email: null },
    });

    render(<Welcome />);
    await click(screen.getByRole('button', { name: /I already have an account/i }));
    fireEvent.change(screen.getByPlaceholderText(/username or email/i), {
      target: { value: 'new' },
    });
    fireEvent.change(screen.getByPlaceholderText(/At least 8 characters/i), {
      target: { value: 'password1' },
    });
    await click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('About you')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
});
