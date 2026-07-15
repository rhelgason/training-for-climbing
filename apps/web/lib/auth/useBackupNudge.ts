'use client';

/**
 * Decides whether to show the "your data isn't backed up" nudge. Visible only
 * when signed out and not previously dismissed. Dismissal is persisted.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSession, isSignedIn } from './session';

const DISMISS_KEY = 'tfc.backupNudgeDismissed';

export interface BackupNudge {
  visible: boolean;
  dismiss: () => void;
}

export function useBackupNudge(): BackupNudge {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    setVisible(!isSignedIn(getSession()) && !dismissed);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    window.localStorage.setItem(DISMISS_KEY, '1');
  }, []);

  return { visible, dismiss };
}
