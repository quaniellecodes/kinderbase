import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import {
  getStaffHeader,
  getStaffSchedule,
  getStaffCredentials,
  getStaffAttendance,
  getStaffTimeHistory,
  getStaffNotes,
} from './actions';
import { StaffHero } from '@/components/staff/StaffHero';
import { ContactCard } from '@/components/staff/ContactCard';
import { AvailabilityCard } from '@/components/staff/AvailabilityCard';
import { QuickActionsCard } from '@/components/staff/QuickActionsCard';
import { StaffTopbar } from '@/components/staff/StaffTopbar';
import { ScheduleGrid } from '@/components/staff/ScheduleGrid';
import { CredentialsTab } from '@/components/staff/CredentialsTab';
import { AttendanceTab } from '@/components/staff/AttendanceTab';
import { TimeHistoryTab } from '@/components/staff/TimeHistoryTab';
import { NotesTab } from '@/components/staff/NotesTab';

type Tab = 'schedule' | 'credentials' | 'attendance' | 'time' | 'notes';
type Props = { params: { userId: string }; searchParams: { tab?: string } };

export default async function StaffProfilePage({ params, searchParams }: Props) {
  const header = await getStaffHeader(params.userId);
  if (!header) notFound();

  const active = getActiveContextFromCookies();
  const centerName = active?.centerName ?? 'Center';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'credentials', label: 'Credentials' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'time', label: 'Time history' },
    ...(header.admin ? [{ key: 'notes' as Tab, label: 'Notes' }] : []),
  ];
  let tab = (searchParams.tab as Tab) ?? 'schedule';
  if (!tabs.some((t) => t.key === tab)) tab = 'schedule'; // employee requesting notes → schedule

  // Only the active tab fetches (no waterfall).
  let content: React.ReactNode = null;
  if (tab === 'schedule') {
    const schedule = await getStaffSchedule(params.userId);
    content = schedule ? <ScheduleGrid userId={params.userId} schedule={schedule} canEdit={header.admin} /> : null;
  } else if (tab === 'credentials') {
    content = <CredentialsTab userId={params.userId} credentials={await getStaffCredentials(params.userId)} />;
  } else if (tab === 'attendance') {
    const data = await getStaffAttendance(params.userId);
    content = data ? <AttendanceTab userId={params.userId} data={data} /> : null;
  } else if (tab === 'time') {
    const data = await getStaffTimeHistory(params.userId);
    content = data ? <TimeHistoryTab userId={params.userId} data={data} canExport={header.admin} /> : null;
  } else if (tab === 'notes' && header.admin) {
    content = <NotesTab userId={params.userId} userName={header.fullName} notes={await getStaffNotes(params.userId)} />;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Link href="/staff" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Staff
          </Link>
          <h1 className="text-base font-medium text-gray-900">Staff Profile</h1>
        </div>
        <StaffTopbar header={header} />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-[272px] flex-shrink-0 space-y-4 md:sticky md:top-4 self-start">
          <StaffHero header={header} centerName={centerName} />
          <ContactCard header={header} canEdit={header.admin || header.isSelf} />
          <AvailabilityCard header={header} canEdit={header.admin || header.isSelf} />
          {header.admin && <QuickActionsCard userId={params.userId} userName={header.fullName} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-5 border-b border-gray-100 mb-4">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/staff/${params.userId}?tab=${t.key}`}
                className={`text-sm py-2.5 font-medium transition-colors ${tab === t.key ? 'text-brand border-b-2 border-brand' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {content}
        </div>
      </div>
    </div>
  );
}
