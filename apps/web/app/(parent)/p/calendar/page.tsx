import { getClock } from '@/lib/clock';
import { getParentCalendar } from '@/lib/parent/calendar';
import { ParentCalendarClient } from '@/components/parent/ParentCalendarClient';

export const dynamic = 'force-dynamic';

export default async function ParentCalendarPage() {
  const cal = await getParentCalendar();
  if (!cal) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  const now = getClock().now();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return <ParentCalendarClient entries={cal.entries} centerName={cal.centerName} todayIso={todayIso} />;
}
