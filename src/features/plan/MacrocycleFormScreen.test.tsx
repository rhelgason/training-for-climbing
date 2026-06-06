import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { MacrocycleFormScreen } from './MacrocycleFormScreen';
import { formatYmd } from './macrocycle';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof MacrocycleFormScreen>[0]['navigation'];
type Route = Parameters<typeof MacrocycleFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <MacrocycleFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'm', name: 'MacrocycleForm', params: undefined } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('MacrocycleFormScreen', () => {
  it('creates a period with parsed dates', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByTestId('period-label')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(view.getByTestId('period-label'), 'Winter base');
      fireEvent.changeText(view.getByTestId('period-start'), '2026-01-01');
      fireEvent.changeText(view.getByTestId('period-end'), '2026-03-31');
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save period'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const periods = await repo.listMacrocyclePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].label).toBe('Winter base');
    expect(formatYmd(periods[0].startDate)).toBe('2026-01-01');
    expect(formatYmd(periods[0].endDate)).toBe('2026-03-31');
  });

  it('refuses to save an invalid date range', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByTestId('period-label')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(view.getByTestId('period-label'), 'Bad');
      fireEvent.changeText(view.getByTestId('period-start'), '2026-05-01');
      fireEvent.changeText(view.getByTestId('period-end'), '2026-04-01');
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save period'));
    });

    expect(goBack).not.toHaveBeenCalled();
    expect(await repo.listMacrocyclePeriods()).toHaveLength(0);
  });
});
