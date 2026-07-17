import { InMemoryRepository } from '@tfc/core';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { getSession, saveSession } from './session';
import { AccountScreen } from './AccountScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderScreen(repo: InMemoryRepository) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <AccountScreen />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

const authResult = { token: 'jwt-xyz', user: { id: 'u9', email: 'climber@example.com' } };

describe('AccountScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it('registers, persists a session, and runs an initial sync', async () => {
    const repo = new InMemoryRepository();
    await repo.init();

    const calls: string[] = [];
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
      url: string,
      init: RequestInit,
    ) => {
      calls.push(`${init.method ?? 'GET'} ${url}`);
      if (url.endsWith('/auth/register') || url.endsWith('/auth/login')) {
        return { ok: true, status: 200, json: async () => authResult } as Response;
      }
      // snapshot GET/PUT during the initial sync
      return { ok: true, status: 200, json: async () => ({ data: null }) } as Response;
    }) as unknown as typeof fetch;

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByTestId('account-email')).toBeTruthy());

    // Switch to register mode.
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Create a new account' }));
    });

    await act(async () => {
      fireEvent.changeText(view.getByTestId('account-url'), 'https://srv.example.com');
      fireEvent.changeText(view.getByTestId('account-email'), 'climber@example.com');
      fireEvent.changeText(view.getByTestId('account-password'), 'password123');
    });

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Create account' }));
    });

    // Lands on the signed-in view.
    await waitFor(() => expect(view.getByText('climber@example.com')).toBeTruthy());

    const session = await getSession();
    expect(session).toMatchObject({ token: 'jwt-xyz', userId: 'u9', email: 'climber@example.com' });
    expect(calls.some((c) => c.includes('/auth/register'))).toBe(true);
    expect(calls.some((c) => c.includes('/snapshot'))).toBe(true);
  });

  it('shows the signed-in state and signs out', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await saveSession({
      url: 'https://srv.example.com',
      token: 'jwt-xyz',
      userId: 'u9',
      email: 'climber@example.com',
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Account')).toBeTruthy());
    expect(view.getByText('climber@example.com')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
    });

    // Back to the signed-out form.
    await waitFor(() => expect(view.getByTestId('account-email')).toBeTruthy());
    expect(await getSession()).toBeNull();
  });

  it('deletes the account after confirmation and returns to signed-out', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await saveSession({
      url: 'https://srv.example.com',
      token: 'jwt-xyz',
      userId: 'u9',
      email: 'climber@example.com',
    });

    const calls: string[] = [];
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
      url: string,
      init: RequestInit,
    ) => {
      calls.push(`${init.method ?? 'GET'} ${url}`);
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;

    // Auto-confirm the destructive alert.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = (buttons ?? []).find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Account')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Delete account'));
    });

    await waitFor(() => expect(view.getByTestId('account-email')).toBeTruthy());
    expect(calls).toContain('DELETE https://srv.example.com/account');
    expect(await getSession()).toBeNull();

    alertSpy.mockRestore();
  });
});
