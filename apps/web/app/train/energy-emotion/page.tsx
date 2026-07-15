'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EMOTION_MAX,
  EMOTION_MIN,
  ENERGY_MAX,
  now,
  quadrantOf,
  readingsForDay,
  type CheckinRecord,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository } from '@/lib/db/RepositoryProvider';
import { triadColors } from '@/lib/theme';

const ENERGY_COLOR = triadColors.physical;
const EMOTION_COLOR = triadColors.mental;

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function DayChart({ readings }: { readings: CheckinRecord[] }) {
  const width = 320;
  const height = 180;
  const pad = 24;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i: number) =>
    readings.length <= 1 ? pad + innerW / 2 : pad + (i / (readings.length - 1)) * innerW;
  const yEnergy = (v: number) => pad + innerH - (v / ENERGY_MAX) * innerH;
  const yEmotion = (v: number) =>
    pad + innerH - ((v - EMOTION_MIN) / (EMOTION_MAX - EMOTION_MIN)) * innerH;

  const energyPts = readings.map((r, i) => `${x(i)},${yEnergy(r.energy)}`).join(' ');
  const emotionPts = readings.map((r, i) => `${x(i)},${yEmotion(r.emotion)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Energy and emotion over today"
    >
      {/* midline = high/low energy boundary (energy 5) */}
      <line
        x1={pad}
        y1={yEnergy(5)}
        x2={width - pad}
        y2={yEnergy(5)}
        stroke="var(--color-border)"
        strokeWidth={1}
      />
      <polyline points={energyPts} fill="none" stroke={ENERGY_COLOR} strokeWidth={2} />
      <polyline points={emotionPts} fill="none" stroke={EMOTION_COLOR} strokeWidth={2} />
      {readings.map((r, i) => (
        <circle key={`e${r.id}`} cx={x(i)} cy={yEnergy(r.energy)} r={3} fill={ENERGY_COLOR} />
      ))}
      {readings.map((r, i) => (
        <circle key={`m${r.id}`} cx={x(i)} cy={yEmotion(r.emotion)} r={3} fill={EMOTION_COLOR} />
      ))}
      <text x={pad} y={12} fill="var(--color-muted)" fontSize={10}>
        energy / emotion over today
      </text>
    </svg>
  );
}

export default function EnergyEmotionScreen() {
  const repo = useRepository();
  const [checkins, setCheckins] = useState<CheckinRecord[] | null>(null);

  useEffect(() => {
    let on = true;
    repo.listCheckins().then((c) => {
      if (on) setCheckins(c);
    });
    return () => {
      on = false;
    };
  }, [repo]);

  if (checkins === null) return <Screen />;

  const today = readingsForDay(checkins, now());

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Energy &amp; emotion</h1>
      <p className="mt-2 text-base leading-6 text-muted">
        Log your physical energy and mind-set through the day to spot patterns and triggers.
      </p>

      <Link href="/train/checkin" className="mt-4 block">
        <Button>+ Log check-in</Button>
      </Link>

      <h2 className="mt-6 mb-2 text-lg font-bold">Today</h2>
      {today.length === 0 ? (
        <p className="text-muted">No check-ins today yet.</p>
      ) : (
        <>
          <Card className="mb-4 flex flex-col items-center">
            <DayChart readings={today} />
            <div className="mt-2 flex flex-row gap-4">
              <span className="text-sm font-semibold" style={{ color: ENERGY_COLOR }}>
                ● energy
              </span>
              <span className="text-sm font-semibold" style={{ color: EMOTION_COLOR }}>
                ● emotion
              </span>
            </div>
          </Card>
          {today
            .slice()
            .reverse()
            .map((c) => {
              const q = quadrantOf(c.energy, c.emotion);
              return (
                <div key={c.id} className="mb-2">
                  <Card>
                    <div className="flex flex-row justify-between">
                      <span className="font-semibold">{formatTime(c.time)}</span>
                      <span
                        className={`text-sm ${q.optimal ? 'font-bold text-success' : 'text-muted'}`}
                      >
                        {q.id} · {q.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-primary">
                      energy {c.energy}/10 · emotion {c.emotion > 0 ? `+${c.emotion}` : c.emotion}
                    </p>
                    {c.note ? <p className="mt-1 text-sm leading-5 text-muted">{c.note}</p> : null}
                  </Card>
                </div>
              );
            })}
        </>
      )}
    </Screen>
  );
}
