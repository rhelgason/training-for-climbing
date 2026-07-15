'use client';

import Link from 'next/link';
import { GLOSSARY } from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';

export default function MoreHome() {
  return (
    <Screen>
      <h1 className="text-2xl font-bold">More</h1>
      <p className="text-muted">Your profile, settings, and reference.</p>

      <Card>
        <h2 className="text-lg font-semibold">Profile &amp; settings</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Ability tier, default discipline, reassessment cadence, and the AI coach.
        </p>
        <Link href="/more/profile" className="mt-4 block">
          <Button>Open profile</Button>
        </Link>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Account &amp; sync</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Sign in to back up your data and sync it across devices.
        </p>
        <Link href="/more/account" className="mt-4 block">
          <Button variant="secondary">Open account</Button>
        </Link>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Glossary</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {GLOSSARY.length} key climbing and training terms, searchable.
        </p>
        <Link href="/more/glossary" className="mt-4 block">
          <Button variant="secondary">Open glossary</Button>
        </Link>
      </Card>
    </Screen>
  );
}
