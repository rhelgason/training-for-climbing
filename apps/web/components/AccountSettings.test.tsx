import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepositoryProvider } from '@/lib/db/RepositoryProvider';
import { saveSession } from '@/lib/auth/session';
import { AccountSettings } from './AccountSettings';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  usePathname: () => '/more',
  useParams: () => ({}),
}));

describe('AccountSettings (signed out)', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the sign-in form with Username/Password fields and the create-account toggle', async () => {
    render(
      <RepositoryProvider>
        <AccountSettings />
      </RepositoryProvider>,
    );

    // Provider blocks on async IndexedDB init, so wait for content to appear.
    expect(await screen.findByText('Username')).toBeInTheDocument();
    expect(await screen.findByText('Password')).toBeInTheDocument();
    expect(await screen.findByText('Create a new account')).toBeInTheDocument();

    // Sign-in asks for no email at all; it only appears, optional, on sign-up.
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });

  it('offers an explicitly optional email once switched to sign-up', async () => {
    render(
      <RepositoryProvider>
        <AccountSettings />
      </RepositoryProvider>,
    );

    fireEvent.click(await screen.findByText('Create a new account'));

    expect(await screen.findByText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Leave blank to skip')).toBeInTheDocument();
  });
});

describe('AccountSettings (expired session)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveSession({
      token: 'stale-token',
      userId: 'user-1',
      username: 'climber',
      email: 'climber@example.com',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  /**
   * A token the server no longer accepts (expired, or JWT_SECRET rotated) can't
   * be retried into working. The provider's sync-on-mount is the path users
   * actually hit after a rotation, and it should land them on the sign-in form
   * with the dead session cleared — not leave them staring at "Sync failed".
   */
  it('clears the session and shows the sign-in form when sync gets a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })),
    );

    render(
      <RepositoryProvider>
        <AccountSettings />
      </RepositoryProvider>,
    );

    expect(await screen.findByText('Create a new account')).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem('tfc.auth')).toBeNull());
  });

  /** A transient failure must NOT sign anyone out — the token is still good. */
  it('keeps the session when sync fails for a non-auth reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 503 })),
    );

    render(
      <RepositoryProvider>
        <AccountSettings />
      </RepositoryProvider>,
    );

    expect(await screen.findByText('climber')).toBeInTheDocument();
    expect(window.localStorage.getItem('tfc.auth')).not.toBeNull();
  });
});
