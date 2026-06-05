import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { SessionFormScreen } from './SessionFormScreen';
import { dayIndex } from './log';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof SessionFormScreen>[0]['navigation'];
type Route = Parameters<typeof SessionFormScreen>[0]['route'];

function renderForm(repo: InMemoryRepository, navigation: Partial<Nav>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <SessionFormScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 's', name: 'SessionForm' } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('SessionFormScreen', () => {
  it('logs a session with chosen focus areas dated today', async () => {
    const repo = new InMemoryRepository();
    const goBack = jest.fn();
    const view = await renderForm(repo, { goBack });

    await waitFor(() => expect(view.getByText('When')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('area-skill'));
      fireEvent.press(view.getByTestId('area-maxStrengthPower'));
      fireEvent.changeText(view.getByTestId('session-notes'), 'Bouldering, felt strong');
    });

    await act(async () => {
      fireEvent.press(view.getByText('Save session'));
    });

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const sessions = await repo.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].focusAreas).toEqual(['skill', 'maxStrengthPower']);
    expect(sessions[0].notes).toBe('Bouldering, felt strong');
    expect(dayIndex(sessions[0].date)).toBe(dayIndex(Date.now()));
  });
});
