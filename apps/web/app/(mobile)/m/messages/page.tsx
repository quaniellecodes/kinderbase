import { redirect } from 'next/navigation';
import { getThreads } from './actions';
import { MessagesClient } from './MessagesClient';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const data = await getThreads();
  if (!data) redirect('/dashboard');
  return <MessagesClient data={data} />;
}
