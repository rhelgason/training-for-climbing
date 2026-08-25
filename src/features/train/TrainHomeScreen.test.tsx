import { type CoachSuggestion, InMemoryRepository } from '@tfc/core';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RepositoryProvider } from '../../providers/RepositoryProvider';
import { saveSession } from '../auth/session';
import { saveCachedSuggestion } from '../coach/coachCache';
import { now } from '../../lib/clock';
import { TrainHomeScreen } from './TrainHomeScreen';

// Run focus effects like mount effects (no NavigationContainer in unit tests).
jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factories can't use ESM imports
  const ReactLocal = require('react');
  return { useFocusEffect: (cb: () => void) => ReactLocal.useEffect(cb, []) };
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Nav = Parameters<typeof TrainHomeScreen>[0]['navigation'];

async function renderScreen(repo: InMemoryRepository, navigation: Partial<Nav> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RepositoryProvider repository={repo}>
        <TrainHomeScreen
          navigation={{ navigate: jest.fn(), ...navigation } as unknown as Nav}
          route={{ key: 't', name: 'TrainHome' } as never}
        />
      </RepositoryProvider>
    </SafeAreaProvider>,
  );
}

const aiSuggestion: CoachSuggestion = {
  focusArea: 'physical',
  headline: 'AI power day',
  plan: ['Warm up', 'Limit bouldering'],
  rationale: 'Physical is your weakest area right now.',
  watchOuts: ['Watch your fingers'],
};

describe('TrainHomeScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it('shows the deterministic Today plan when the AI coach is off', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveAssessment({
      responses: {},
      mental: 20,
      technical: 40,
      physical: 45,
      weakestArea: 'mental',
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Today')).toBeTruthy());
    // The scheduler picks the focus, so the headline names the session rather
    // than the triad area — but it still targets the weakest area.
    expect(view.getByText('Today: Mental game')).toBeTruthy();
    expect(view.getByText("Today's plan")).toBeTruthy();
    // No coach button when AI is disabled.
    expect(view.queryByText('Get AI suggestion')).toBeNull();
  });

  it('shows the getting-started checklist and routes its steps', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const navigate = jest.fn();
    const navigateParent = jest.fn();

    const view = await renderScreen(repo, {
      navigate,
      getParent: () => ({ navigate: navigateParent }) as never,
    });
    await waitFor(() => expect(view.getByText('Getting started')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-assess'));
    });
    expect(navigateParent).toHaveBeenCalledWith('Assess', { screen: 'Assessment' });

    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-journal'));
    });
    expect(navigate).toHaveBeenCalledWith('JournalForm', {});
  });

  it('hides the checklist once assessment, goal, and journal all exist', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveAssessment({
      responses: {},
      mental: 30,
      technical: 40,
      physical: 45,
      weakestArea: 'mental',
    });
    await repo.saveGoal({ horizon: 'short', title: 'Send the slab' });
    await repo.saveJournal({ date: Date.now(), activities: ['climbing'] });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Today')).toBeTruthy());
    expect(view.queryByText('Getting started')).toBeNull();
  });

  it('shows the backup nudge when signed out and routes to Account', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const navigateParent = jest.fn();

    const view = await renderScreen(repo, {
      getParent: () => ({ navigate: navigateParent }) as never,
    });
    await waitFor(() => expect(view.getByText("Your training isn't backed up")).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Sign in'));
    });
    expect(navigateParent).toHaveBeenCalledWith('More', { screen: 'Account' });
  });

  it('hides the backup nudge when signed in', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await saveSession({
      url: 'https://srv.example.com',
      token: 'secret',
      userId: 'u1',
      username: 'climber',
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Today')).toBeTruthy());
    expect(view.queryByText("Your training isn't backed up")).toBeNull();
  });

  it('shows the cached AI suggestion (with "updated" stamp) when enabled', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveProfile({ aiCoachEnabled: true });
    await saveSession({
      url: 'https://srv.example.com',
      token: 'secret',
      userId: 'u1',
      username: 'climber',
    });
    await saveCachedSuggestion({ suggestion: aiSuggestion, generatedAt: now() });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('AI coach')).toBeTruthy());
    expect(view.getByText('AI power day')).toBeTruthy();
    expect(view.getByText(/Watch your fingers/)).toBeTruthy();
    expect(view.getByText(/^updated /)).toBeTruthy();
    expect(view.getByText('Refresh AI suggestion')).toBeTruthy();
  });

  it('records thumbs feedback on the AI suggestion', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveProfile({ aiCoachEnabled: true });
    await saveSession({
      url: 'https://srv.example.com',
      token: 'secret',
      userId: 'u1',
      username: 'climber',
    });
    await saveCachedSuggestion({ suggestion: aiSuggestion, generatedAt: now() });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('AI coach')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('coach-thumbs-up'));
    });
    await waitFor(() => expect(view.getByText(/Thanks/)).toBeTruthy());
    const events = await repo.listEvents();
    expect(events.some((e) => e.name === 'coach_feedback')).toBe(true);
  });

  it('shows a streak chip after consecutive training days', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const today = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    await repo.saveJournal({ date: today, activities: ['climbing'] });
    await repo.saveJournal({ date: today - DAY, activities: ['fingerboard'] });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText(/day streak/)).toBeTruthy());
  });

  it('refreshes the suggestion on demand', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveProfile({ aiCoachEnabled: true });
    await saveSession({
      url: 'https://srv.example.com',
      token: 'secret',
      userId: 'u1',
      username: 'climber',
    });
    await saveCachedSuggestion({
      suggestion: { ...aiSuggestion, headline: 'Old plan' },
      generatedAt: now(),
    });

    const view = await renderScreen(repo);
    await waitFor(() => expect(view.getByText('Old plan')).toBeTruthy());

    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ suggestion: aiSuggestion }),
      }) as Response) as unknown as typeof fetch;

    await act(async () => {
      fireEvent.press(view.getByText('Refresh AI suggestion'));
    });

    await waitFor(() => expect(view.getByText('AI power day')).toBeTruthy());
  });
});
