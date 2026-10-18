import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { TimeLogView } from '@/components/time/TimeLogView';
import { getTimeLog, getMyTimesheet } from '@/app/(dashboard)/timelog/actions';

export const dynamic = 'force-dynamic';

export default async function MobileTimeLogPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/login');

  if (isAdmin(active.role)) {
    const log = await getTimeLog();
    return <TimeLogView mode="admin" log={log} title="Time log" variant="mobile" back="/m/admin" />;
  }
  const sheet = await getMyTimesheet();
  if (!sheet) redirect('/login');
  return <TimeLogView mode="me" sheet={sheet} title="My timesheet" variant="mobile" back="/m/today" />;
}
