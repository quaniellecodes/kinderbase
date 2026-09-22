import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getApprovals } from '../approvals-actions';
import { getAgingFamilyThreads } from '../../messages/actions';
import { InboxClient } from './InboxClient';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage() {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) redirect('/m/today');
  const [approvals, aging] = await Promise.all([getApprovals(), getAgingFamilyThreads()]);
  return <InboxClient approvals={approvals} aging={aging} />;
}
