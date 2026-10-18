import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParentShell } from '@/lib/parent/shell';
import { ParentNav } from '@/components/parent/ParentNav';

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
      <header
        className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2.5 flex-shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {shell.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shell.iconUrl} alt="" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
            {shell.centerName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{shell.centerName}</p>
          <p className="text-[11px] text-gray-500 truncate">{shell.childName}</p>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-[76px]">{children}</main>

      <ParentNav firstName={shell.firstName} />
    </div>
  );
}
