import { InMemoryRepository } from '@tfc/core';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { JournalFormScreen } from './JournalFormScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof JournalFormScreen>[0]['navigation'];
type Route = Parameters<typeof JournalFormScreen>[0]['route'];

function renderForm(
  repo: InMemoryRepository,
  navigation: Partial<Nav>,
  params: { journalId?: string } = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <JournalFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'j', name: 'JournalForm', params } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('JournalFormScreen', () => {
  it('logs a new daily journal with activities, intensity, and free text', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack, setOptions: jest.fn() });

    await waitFor(() => expect(view.getByText('What did you do?')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('activity-climbing'));
      fireEvent.press(view.getByTestId('intensity-hard'));
      fireEvent.changeText(view.getByTestId('journal-summary'), 'Worked the cave project');
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const journals = await repo.listJournals();
    expect(journals).toHaveLength(1);
    expect(journals[0]).toMatchObject({
      activities: ['climbing'],
      intensity: 'hard',
      summary: 'Worked the cave project',
    });
  });

  it('loads an existing entry for editing and updates it in place', async () => {
    const repo = new InMemoryRepository();
    const existing = await repo.saveJournal({
      date: 1000,
      activities: ['strength'],
      summary: 'Lifting day',
    });
    const goBack = jest.fn();
    const view = await renderForm(
      repo,
      { goBack, setOptions: jest.fn() },
      { journalId: existing.id },
    );

    await waitFor(() => expect(view.getByDisplayValue('Lifting day')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(view.getByTestId('journal-summary'), 'Lifting day, felt strong');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Save entry'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const journals = await repo.listJournals();
    expect(journals).toHaveLength(1);
    expect(journals[0].summary).toBe('Lifting day, felt strong');
  });

  it('deletes an existing entry after confirmation', async () => {
    const repo = new InMemoryRepository();
    const existing = await repo.saveJournal({ date: 1000, activities: ['climbing'] });
    const goBack = jest.fn();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      (buttons ?? []).find((b) => b.style === 'destructive')?.onPress?.();
    });

    const view = await renderForm(
      repo,
      { goBack, setOptions: jest.fn() },
      { journalId: existing.id },
    );
    await waitFor(() => expect(view.getByText('Delete entry')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Delete entry'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(await repo.listJournals()).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it('has no delete action when creating a new entry', async () => {
    const repo = new InMemoryRepository();
    const view = await renderForm(repo, { goBack: jest.fn(), setOptions: jest.fn() });
    await waitFor(() => expect(view.getByText('What did you do?')).toBeTruthy());
    expect(view.queryByText('Delete entry')).toBeNull();
  });
});
