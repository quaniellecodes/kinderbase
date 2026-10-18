import { getParentMessages } from '@/lib/parent/messages';
import { ParentMessagesClient } from '@/components/parent/ParentMessagesClient';

export const dynamic = 'force-dynamic';

export default async function ParentMessagesPage() {
  const data = await getParentMessages();
  if (!data) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return <ParentMessagesClient data={data} />;
}
