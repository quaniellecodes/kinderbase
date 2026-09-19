import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getActiveEntry, getTimeEntries } from './actions';
import { ClockButton } from '@/components/time/ClockButton';
import { TimeSheet } from '@/components/time/TimeSheet';
import { AdminTimeSheet } from '@/components/time/AdminTimeSheet';

export default async function TimePage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const adminView = isAdmin(active.role);

  const [activeEntry, entries] = await Promise.all([
    getActiveEntry(active.centerId),
    getTimeEntries(active.centerId, adminView),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-medium text-gray-900 mb-6">
        {adminView ? 'Time Sheet' : 'My Time'}
      </h1>

      <div className="flex justify-center mb-8">
        <ClockButton centerId={active.centerId} initialEntry={activeEntry} />
      </div>

      {adminView
        ? <AdminTimeSheet entries={entries as never} />
        : <TimeSheet entries={entries as never} showNames={false} />
      }
    </div>
  );
}
