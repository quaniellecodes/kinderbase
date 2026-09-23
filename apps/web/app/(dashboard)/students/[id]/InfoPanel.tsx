import { notFound } from 'next/navigation';
import { getStudentInfo } from './student-detail-actions';
import { InfoEditor } from './InfoEditor';

export async function InfoPanel({ childId }: { childId: string }) {
  const info = await getStudentInfo(childId);
  if (!info) notFound();
  return <InfoEditor childId={childId} info={info} />;
}
