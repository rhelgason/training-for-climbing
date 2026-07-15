import { MacrocycleForm } from '@/components/MacrocycleForm';

export default async function EditMacrocyclePeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  return <MacrocycleForm periodId={periodId} />;
}
