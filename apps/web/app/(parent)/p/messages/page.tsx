import { getParentMessages } from '@/lib/parent/messages';
import { ParentMessagesClient } from '@/components/parent/ParentMessagesClient';

export const dynamic = 'force-dynamic';

export default async function ParentMessagesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const data = await getParentMessages();
  if (!data) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  const initialKind = searchParams.tab === 'office' ? 'office' : 'family';
  return <ParentMessagesClient data={data} initialKind={initialKind} />;
}
