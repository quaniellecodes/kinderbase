import { getParentProgress } from '@/lib/parent/progress';
import { ParentProgressClient } from '@/components/parent/ParentProgressClient';

export const dynamic = 'force-dynamic';

export default async function ParentProgressPage() {
  const data = await getParentProgress();
  if (!data) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return <ParentProgressClient data={data} />;
}
