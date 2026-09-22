import { notFound } from 'next/navigation';
import { getThread } from '../actions';
import { ThreadClient } from './ThreadClient';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const thread = await getThread(params.threadId);
  if (!thread) notFound();
  return <ThreadClient thread={thread} />;
}
