import { getParentThread } from '@/lib/parent/messages';
import { ParentThreadClient } from '@/components/parent/ParentThreadClient';

export const dynamic = 'force-dynamic';

export default async function ParentMessagesPage() {
  const thread = await getParentThread();
  if (!thread) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return <ParentThreadClient thread={thread} />;
}
