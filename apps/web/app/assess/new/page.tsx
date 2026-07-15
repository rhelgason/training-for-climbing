'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RATING_LABELS,
  SELF_ASSESSMENT_QUESTIONS,
  evaluate,
  isComplete,
  trackEvent,
  unansweredQuestionIds,
  type Responses,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RatingSelector } from '@/components/RatingSelector';
import { Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { useRepository } from '@/lib/db/RepositoryProvider';

export default function AssessmentScreen() {
  const repo = useRepository();
  const router = useRouter();
  const [responses, setResponses] = useState<Responses>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    trackEvent('assessment_started');
  }, []);

  const answeredCount = useMemo(() => Object.keys(responses).length, [responses]);
  const complete = isComplete(responses);

  const setRating = (id: number, value: number) =>
    setResponses((prev) => ({ ...prev, [id]: value }));

  const onSubmit = async () => {
    if (!complete) {
      const missing = unansweredQuestionIds(responses);
      window.alert(
        `Please answer all questions. ${missing.length} remaining (e.g. #${missing[0]}).`,
      );
      return;
    }
    setSaving(true);
    try {
      const result = evaluate(responses);
      const saved = await repo.saveAssessment({
        responses,
        mental: result.scores.mental,
        technical: result.scores.technical,
        physical: result.scores.physical,
        weakestArea: result.weakestArea,
      });
      trackEvent('assessment_completed', {
        mental: result.scores.mental,
        technical: result.scores.technical,
        physical: result.scores.physical,
        weakestArea: result.weakestArea,
      });
      router.replace(`/assess/results/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Self-Assessment" />
      <Screen>
        <h2 className="text-xl font-bold">Rate your recent climbing</h2>
        <Card>
          <p className="mb-1 font-semibold">Scale</p>
          {RATING_LABELS.map((label, i) => (
            <p key={label} className="text-sm leading-5 text-muted">
              <span className="font-bold text-text">{i}</span> — {label}
            </p>
          ))}
        </Card>

        {SELF_ASSESSMENT_QUESTIONS.map((q) => (
          <div key={q.id}>
            <p className="mb-2 leading-6">
              {q.id}. {q.prompt}
            </p>
            <RatingSelector value={responses[q.id]} onChange={(v) => setRating(q.id, v)} />
          </div>
        ))}

        <p className="text-center text-sm text-muted">
          {answeredCount}/{SELF_ASSESSMENT_QUESTIONS.length} answered
        </p>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Saving…' : 'See results'}
        </Button>
      </Screen>
    </>
  );
}
