import { notFound } from 'next/navigation';
import { getStudentHealth } from './health-actions';
import { HealthEditor } from './HealthEditor';

export async function HealthPanel({ childId }: { childId: string }) {
  const health = await getStudentHealth(childId);
  if (!health) notFound();
  return <HealthEditor childId={childId} health={health} />;
}
