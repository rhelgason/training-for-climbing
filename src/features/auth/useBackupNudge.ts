/**
 * Decides whether to show the "your data isn't backed up" nudge. Visible only
 * when signed out and not previously dismissed; re-checked on focus so it
 * disappears right after the user signs in. Dismissal is persisted (one-time).
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSession, isSignedIn } from './session';

const DISMISS_KEY = 'tfc.backupNudgeDismissed';

export interface BackupNudge {
  visible: boolean;
  dismiss: () => void;
}

export function useBackupNudge(): BackupNudge {
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all([getSession(), AsyncStorage.getItem(DISMISS_KEY)]).then(
        ([session, dismissed]) => {
          if (on) setVisible(!isSignedIn(session) && dismissed !== '1');
        },
      );
      return () => {
        on = false;
      };
    }, []),
  );

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, '1');
  }, []);

  return { visible, dismiss };
}
