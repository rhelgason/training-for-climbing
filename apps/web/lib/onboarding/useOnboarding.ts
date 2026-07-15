'use client';

/**
 * Tracks whether the first-run "Getting started" checklist has been dismissed.
 * Dismissal is persisted in localStorage. Completion (which steps are done) is
 * computed by the host screen from its data.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'tfc.onboardingDismissed';

export interface OnboardingState {
  dismissed: boolean;
  dismiss: () => void;
}

export function useOnboarding(): OnboardingState {
  const [dismissed, setDismissed] = useState(true); // assume hidden until we know

  useEffect(() => {
    setDismissed(window.localStorage.getItem(KEY) === '1');
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    window.localStorage.setItem(KEY, '1');
  }, []);

  return { dismissed, dismiss };
}
