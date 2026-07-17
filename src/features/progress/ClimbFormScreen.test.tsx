import { InMemoryRepository } from '@tfc/core';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { ClimbFormScreen } from './ClimbFormScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof ClimbFormScreen>[0]['navigation'];
type Route = Parameters<typeof ClimbFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <ClimbFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'c', name: 'ClimbForm' } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('ClimbFormScreen', () => {
  it('logs a climb with the selected attributes', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByText('Grade')).toBeTruthy());

    // Switch discipline first so the route grade scale renders.
    await act(async () => {
      fireEvent.press(view.getByTestId('discipline-lead'));
    });
    await waitFor(() => expect(view.getByTestId('grade-5.11a')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('env-outdoor'));
      fireEvent.press(view.getByTestId('grade-5.11a'));
      fireEvent.press(view.getByTestId('outcome-onsight'));
    });

    await act(async () => {
      fireEvent.press(view.getByText('Log climb'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const climbs = await repo.listClimbs();
    expect(climbs).toHaveLength(1);
    expect(climbs[0]).toMatchObject({
      environment: 'outdoor',
      discipline: 'lead',
      grade: '5.11a',
      outcome: 'onsight',
    });
  });

  it('requires a grade before saving', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByText('Grade')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Log climb'));
    });

    expect(goBack).not.toHaveBeenCalled();
    expect(await repo.listClimbs()).toHaveLength(0);
  });
});
