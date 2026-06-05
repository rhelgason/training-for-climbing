import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { CheckinFormScreen } from './CheckinFormScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof CheckinFormScreen>[0]['navigation'];
type Route = Parameters<typeof CheckinFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <CheckinFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'c', name: 'CheckinForm' } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('CheckinFormScreen', () => {
  it('logs an energy/emotion reading and classifies the quadrant', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack });

    await waitFor(() => expect(view.getByText('Physical energy')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('energy-8'));
      fireEvent.press(view.getByTestId('emotion-4'));
    });

    // High energy + positive emotion = quadrant II (the performance zone).
    await waitFor(() => expect(view.getByText(/Quadrant II/)).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Log check-in'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const checkins = await repo.listCheckins();
    expect(checkins).toHaveLength(1);
    expect(checkins[0]).toMatchObject({ energy: 8, emotion: 4 });
  });
});
