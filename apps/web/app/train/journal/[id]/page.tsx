import { JournalForm } from '../../../../components/JournalForm';

export default async function EditJournal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalForm journalId={id} />;
}
