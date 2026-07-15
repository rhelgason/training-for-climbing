'use client';

import Link from 'next/link';
import { Card } from './Card';

/**
 * A gentle, dismissible prompt to sign in for cloud backup. Shown only when the
 * user is signed out (see useBackupNudge). The app works fully without it.
 */
export function BackupBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="border-primary">
      <h2 className="font-bold">Your training isn&apos;t backed up</h2>
      <p className="mt-1 text-sm leading-5 text-muted">
        Create a free account to back up your data and sync it across devices. You can keep using
        the app without one.
      </p>
      <div className="mt-4 flex gap-6">
        <Link href="/more/account" onClick={onDismiss} className="font-bold text-primary">
          Sign in
        </Link>
        <button type="button" onClick={onDismiss} className="font-semibold text-muted">
          Not now
        </button>
      </div>
    </Card>
  );
}
