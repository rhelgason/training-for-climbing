import { ClimbForm } from '../../../../../components/ClimbForm';

export default async function EditClimbPage({ params }: { params: Promise<{ climbId: string }> }) {
  const { climbId } = await params;
  return <ClimbForm climbId={climbId} />;
}
