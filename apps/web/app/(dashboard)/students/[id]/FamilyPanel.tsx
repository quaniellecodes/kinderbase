import { notFound } from 'next/navigation';
import { getStudentFamily } from './student-detail-actions';
import { FamilyEditor } from './FamilyEditor';

export async function FamilyPanel({ childId }: { childId: string }) {
  const family = await getStudentFamily(childId);
  if (!family) notFound();
  // Remount (resetting the dirty-form baseline) when the set of rows changes,
  // e.g. after adding or removing a guardian/pickup.
  const key = `${family.guardians.map((g) => g.id).join(',')}|${family.pickups.map((p) => p.id).join(',')}`;
  return <FamilyEditor key={key} childId={childId} family={family} />;
}
