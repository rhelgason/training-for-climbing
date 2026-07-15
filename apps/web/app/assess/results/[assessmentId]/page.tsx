import { AssessResults } from '@/components/AssessResults';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  return <AssessResults id={assessmentId} />;
}
