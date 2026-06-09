import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { ProfileScreen } from './ProfileScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderScreen(repo: InMemoryRepository) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <ProfileScreen />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('ProfileScreen', () => {
  it('shows defaults and persists an AI-coach toggle + ability tier', async () => {
    const repo = new InMemoryRepository();
    await repo.init();

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Profile')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('ai-on'));
    });
    await waitFor(async () => expect((await repo.getProfile())?.aiCoachEnabled).toBe(true));

    await act(async () => {
      fireEvent.press(view.getByTestId('tier-elite'));
    });
    await waitFor(async () => expect((await repo.getProfile())?.abilityTier).toBe('elite'));

    // Earlier choice is preserved across saves (upsert, not overwrite).
    expect((await repo.getProfile())?.aiCoachEnabled).toBe(true);
  });
});
