import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { Toaster } from '@/components/ui';
import { MobileNav } from './MobileNav';

// Mobile shell (docs/DECISIONS.md §12, docs/sessions/02-CLASSROOM.md §1). Phone-first:
// scrollable body + fixed bottom nav with a raised center ＋. Capacitor loads /m.
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Active center context is required (set on first dashboard login).
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 min-w-0 pb-[68px]">{children}</main>
      <MobileNav />
      <Toaster />
    </div>
  );
}
