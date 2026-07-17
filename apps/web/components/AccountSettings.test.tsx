import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RepositoryProvider } from '@/lib/db/RepositoryProvider';
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

  it('shows the sign-in form with Email/Password fields and the create-account toggle', async () => {
    render(
      <RepositoryProvider>
        <AccountSettings />
      </RepositoryProvider>,
    );

    // Provider blocks on async IndexedDB init, so wait for content to appear.
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(await screen.findByText('Password')).toBeInTheDocument();
    expect(await screen.findByText('Create a new account')).toBeInTheDocument();
  });
});
