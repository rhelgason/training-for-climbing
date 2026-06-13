/**
 * Tracks whether the first-run "Getting started" checklist has been dismissed.
 * Re-checked on focus; dismissal is persisted. Completion (which steps are done)
 * is computed by the host screen from its data.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tfc.onboardingDismissed';

export interface OnboardingState {
  dismissed: boolean;
  dismiss: () => void;
}

export function useOnboarding(): OnboardingState {
  const [dismissed, setDismissed] = useState(true); // assume hidden until we know

  useFocusEffect(
    useCallback(() => {
      let on = true;
      AsyncStorage.getItem(KEY).then((v) => {
        if (on) setDismissed(v === '1');
      });
      return () => {
        on = false;
      };
    }, []),
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(KEY, '1');
  }, []);

  return { dismissed, dismiss };
}
