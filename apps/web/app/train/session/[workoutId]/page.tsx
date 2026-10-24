import { PageHeader } from '../../../../components/PageHeader';
import { SessionRunner } from '../../../../components/session/SessionRunner';
import { workoutById } from '@tfc/core';

export default async function RunWorkout({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  return (
    <>
      <PageHeader title={workoutById(workoutId)?.name ?? 'Workout'} />
      <SessionRunner workoutId={workoutId} />
    </>
  );
}
