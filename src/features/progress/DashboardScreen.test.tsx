import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { DashboardScreen } from './DashboardScreen';

jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factories can't use ESM imports
  const ReactLocal = require('react');
  return { useFocusEffect: (cb: () => void) => ReactLocal.useEffect(cb, []) };
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const DAY = 24 * 60 * 60 * 1000;

type Nav = Parameters<typeof DashboardScreen>[0]['navigation'];

async function renderScreen(repo: InMemoryRepository) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <DashboardScreen
          navigation={{ navigate: jest.fn() } as unknown as Nav}
          route={{ key: 'd', name: 'Dashboard' } as never}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

describe('DashboardScreen', () => {
  it('renders the headline stats and recent climb', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveClimb({
      date: Date.now() - 1 * DAY,
      environment: 'indoor',
      discipline: 'boulder',
      grade: 'V4',
      outcome: 'send',
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Progress')).toBeTruthy());
    expect(view.getByText('training days')).toBeTruthy();
    expect(view.getByText('Training consistency')).toBeTruthy();
    expect(view.getByText('Personal bests')).toBeTruthy();
  });

  it('shows fitness-benchmark trends when benchmarks exist', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveBenchmark({ testId: 'max-pullups', value: 10, date: Date.now() - 20 * DAY });
    await repo.saveBenchmark({ testId: 'max-pullups', value: 13, date: Date.now() - 1 * DAY });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Fitness benchmarks')).toBeTruthy());
    expect(view.getByText('Max pull-ups')).toBeTruthy();
  });

  it('surfaces the reassessment nudge once the cadence has elapsed', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveProfile({ reassessWeeks: 8 });
    await repo.saveAssessment({
      createdAt: Date.now() - 70 * DAY, // > 8 weeks
      responses: {},
      mental: 30,
      technical: 40,
      physical: 45,
      weakestArea: 'mental',
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText(/since your last self-assessment/)).toBeTruthy());
  });
});
