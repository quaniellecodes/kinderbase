import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParentShell } from '@/lib/parent/shell';
import { endEmulation } from '@/lib/parent/emulation';
import { ParentNav } from '@/components/parent/ParentNav';
import { ChildSwitcher } from '@/components/parent/ChildSwitcher';

// The parent app shell (PARENT-DECISIONS §7). Guardian-gated: a non-guardian who
// reaches /p (e.g. a staff-only account) is sent to the staff app rather than
// bounced in a loop. Mobile-first; a responsive web fallback, no desktop surface.
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');

  const shell = await getParentShell();
  if (!shell) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ '--color-brand-rgb': shell.brandRgb } as React.CSSProperties}>
      {/* Emulation: loudly visible while active, read-only, with an exit (§7c). */}
      {shell.emulated && (
        <div className="bg-status-red text-white px-4 py-2 flex items-center justify-between gap-2 flex-shrink-0" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <span className="text-[12px] font-medium truncate">Viewing as {shell.emulatedLabel} · read-only</span>
          <form action={endEmulation}>
            <button type="submit" className="text-[12px] font-semibold underline whitespace-nowrap">Exit</button>
          </form>
        </div>
      )}
      <header
        className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2.5 flex-shrink-0"
        style={shell.emulated ? undefined : { paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {shell.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shell.iconUrl} alt="" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
            {shell.centerName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{shell.centerName}</p>
          {shell.childCount > 1 && !shell.emulated ? (
            <ChildSwitcher children={shell.children} activeId={shell.childId} activeLabel={shell.firstName} />
          ) : (
            <p className="text-[11px] text-gray-500 truncate">{shell.childName}</p>
          )}
        </div>
        {/* Staff-app switch keeps the active context unmistakable for teacher-parents
            (PARENT-DECISIONS §7b); the calendar lives here, top-right, on every tab. */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {shell.hasStaff && (
            <a href="/api/context/switch?to=staff" className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Staff&nbsp;app&nbsp;›</a>
          )}
          <Link href="/p/calendar" aria-label="Center calendar" className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500">
            <CalendarDays className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-[76px]">{children}</main>

      <ParentNav firstName={shell.firstName} />
    </div>
  );
}
