import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { TimeLogView } from '@/components/time/TimeLogView';
import { getTimeLog, getMyTimesheet } from './actions';

export const dynamic = 'force-dynamic';

export default async function TimeLogPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/login');

  if (isAdmin(active.role)) {
    const log = await getTimeLog();
    return <TimeLogView mode="admin" log={log} title="Time log" variant="desktop" />;
  }
  const sheet = await getMyTimesheet();
  if (!sheet) redirect('/login');
  return <TimeLogView mode="me" sheet={sheet} title="My timesheet" variant="desktop" />;
}
