'use client';

import Link from 'next/link';
import { GLOSSARY } from '@tfc/core';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { AccountSettings } from '../../components/AccountSettings';
import { TrainingPreferences } from '../../components/TrainingPreferences';

export default function SettingsPage() {
  return (
    <Screen className="gap-8">
      <h1 className="display text-3xl font-extrabold">Settings</h1>

      <AccountSettings />
      <TrainingPreferences />

      <section className="flex flex-col gap-4">
        <h2 className="display text-xl font-bold">Reference</h2>
        <Link href="/more/glossary">
          <Card interactive>
            <p className="font-semibold">Glossary 📖</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {GLOSSARY.length} key climbing and training terms, searchable.
            </p>
          </Card>
        </Link>
      </section>
    </Screen>
  );
}
