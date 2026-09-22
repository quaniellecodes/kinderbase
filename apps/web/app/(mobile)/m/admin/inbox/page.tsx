import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getApprovals } from '../approvals-actions';
import { InboxClient } from './InboxClient';

export default async function AdminInboxPage() {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) redirect('/m/today');
  const approvals = await getApprovals();
  return <InboxClient approvals={approvals} />;
}
