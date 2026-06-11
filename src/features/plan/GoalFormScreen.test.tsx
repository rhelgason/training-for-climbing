import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { GoalFormScreen } from './GoalFormScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof GoalFormScreen>[0]['navigation'];
type Route = Parameters<typeof GoalFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <GoalFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'g', name: 'GoalForm', params: undefined } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('GoalFormScreen', () => {
  it('creates a goal with the chosen horizon and title', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByText('Goal')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('horizon-long'));
      fireEvent.changeText(view.getByTestId('goal-title'), 'Climb my first 5.13');
      fireEvent.press(view.getByTestId('triad-physical'));
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save goal'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const goals = await repo.listGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      horizon: 'long',
      title: 'Climb my first 5.13',
      triadArea: 'physical',
      status: 'active',
    });
  });

  it('scopes deadline options to the chosen horizon', async () => {
    const repo = new InMemoryRepository();
    const view = await renderForm(repo, { goBack: jest.fn(), setOptions: jest.fn() });
    await waitFor(() => expect(view.getByText('Goal')).toBeTruthy());

    // Short-term: days/weeks only — no month/year options.
    await act(async () => {
      fireEvent.press(view.getByTestId('horizon-short'));
    });
    expect(view.getByTestId('deadline-1d')).toBeTruthy();
    expect(view.getByTestId('deadline-1w')).toBeTruthy();
    expect(view.queryByTestId('deadline-1y')).toBeNull();

    // Long-term: years — no day option.
    await act(async () => {
      fireEvent.press(view.getByTestId('horizon-long'));
    });
    expect(view.getByTestId('deadline-1y')).toBeTruthy();
    expect(view.getByTestId('deadline-5y')).toBeTruthy();
    expect(view.queryByTestId('deadline-1d')).toBeNull();
  });

  it('saves a short-term goal with a one-week deadline', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });
    await waitFor(() => expect(view.getByText('Goal')).toBeTruthy());

    // Switch horizon first so the short-term deadline chips render.
    await act(async () => {
      fireEvent.press(view.getByTestId('horizon-short'));
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId('goal-title'), 'Send the cave project');
      fireEvent.press(view.getByTestId('deadline-1w'));
    });
    await act(async () => {
      fireEvent.press(view.getByText('Save goal'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const [goal] = await repo.listGoals();
    expect(goal.horizon).toBe('short');
    expect(typeof goal.targetDate).toBe('number');
    // ~7 days out.
    const daysOut = (goal.targetDate! - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(6);
    expect(daysOut).toBeLessThan(8);
  });

  it('refuses to save without a title', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByText('Goal')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Save goal'));
    });

    expect(goBack).not.toHaveBeenCalled();
    expect(await repo.listGoals()).toHaveLength(0);
  });
});
