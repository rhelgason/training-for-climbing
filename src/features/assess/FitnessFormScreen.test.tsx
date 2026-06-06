import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { FitnessFormScreen } from './FitnessFormScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof FitnessFormScreen>[0]['navigation'];
type Route = Parameters<typeof FitnessFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <FitnessFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'f', name: 'FitnessForm' } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('FitnessFormScreen', () => {
  it('saves only the tests that were filled in, including a bilateral test', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack });

    await waitFor(() => expect(view.getByText('Record evaluation')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(view.getByTestId('fitness-max-pullups'), '12');
      fireEvent.changeText(view.getByTestId('fitness-one-arm-lockoff-left'), '5');
      fireEvent.changeText(view.getByTestId('fitness-one-arm-lockoff-right'), '7');
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save results'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const saved = await repo.listBenchmarks();
    // max-pullups (1) + one-arm-lockoff left/right (2) = 3 records, nothing else.
    expect(saved).toHaveLength(3);
    expect(saved.find((b) => b.testId === 'max-pullups')?.value).toBe(12);
    expect(saved.find((b) => b.side === 'left')?.value).toBe(5);
    expect(saved.find((b) => b.side === 'right')?.value).toBe(7);
  });
});
