import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InMemoryRepository } from '../../db/inMemoryRepository';
import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { SELF_ASSESSMENT_QUESTIONS } from '../../content/selfAssessment';
import { AssessmentScreen } from './AssessmentScreen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof AssessmentScreen>[0]['navigation'];
type Route = Parameters<typeof AssessmentScreen>[0]['route'];

function renderScreen(repo: InMemoryRepository, navigation: Pick<Nav, 'replace'>) {
  // RNTL 14's render is async under React 19.
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <AssessmentScreen
          navigation={navigation as unknown as Nav}
          route={{ key: 'a', name: 'Assessment' } as unknown as Route}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

const ready = (view: Awaited<ReturnType<typeof renderScreen>>) =>
  waitFor(() => expect(view.getByText('Rate your recent climbing')).toBeTruthy(), {
    timeout: 10000,
  });

describe('AssessmentScreen', () => {
  it('saves a completed assessment and navigates to results', async () => {
    const repo = new InMemoryRepository();
    const replace = jest.fn();
    const view = await renderScreen(repo, { replace });

    // Wait for the provider to finish initialising (the title renders).
    await ready(view);

    // Answer every question with the best rating (5 = never a problem).
    await act(async () => {
      for (const q of SELF_ASSESSMENT_QUESTIONS) {
        fireEvent.press(view.getByTestId(`q${q.id}-5`));
      }
    });

    // All answered before submitting.
    await waitFor(() => expect(view.getByText('30/30 answered')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('See results'));
    });

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('Results', { assessmentId: expect.any(String) });

    const saved = await repo.listAssessments();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ mental: 50, technical: 50, physical: 50 });

    // A structured usage event was persisted for analytics.
    const events = await repo.listEvents();
    expect(events.some((e) => e.name === 'assessment_completed')).toBe(true);
  });

  it('does not save when the assessment is incomplete', async () => {
    const repo = new InMemoryRepository();
    const replace = jest.fn();
    const view = await renderScreen(repo, { replace });

    await ready(view);

    // Answer only the first question, then try to submit.
    fireEvent.press(view.getByTestId('q1-4'));
    fireEvent.press(view.getByText('See results'));

    await waitFor(() => expect(view.getByText('1/30 answered')).toBeTruthy());
    expect(replace).not.toHaveBeenCalled();
    expect(await repo.listAssessments()).toHaveLength(0);
  });
});
