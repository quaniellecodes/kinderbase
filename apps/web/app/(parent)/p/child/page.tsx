import { getParentChild } from '@/lib/parent/child';
import { ParentChildClient } from '@/components/parent/ParentChildClient';

export const dynamic = 'force-dynamic';

export default async function ParentChildPage() {
  const c = await getParentChild();
  if (!c) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return <ParentChildClient c={c} />;
}
