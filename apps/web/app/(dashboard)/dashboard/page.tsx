import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { Card } from '@/components/ui';
import { getDirectorDashboard, getDashboardLayout } from './actions';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = getActiveContextFromCookies();
  if (!active) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const admin = isAdmin(active.role);
  const [data, layout] = admin ? await Promise.all([getDirectorDashboard(), getDashboardLayout()]) : [null, []];

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="mb-5 max-w-[1300px] mx-auto">
        <h1 className="text-xl font-medium text-gray-900">{greeting}, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{active.centerName}</p>
      </div>

      {admin && data ? (
        <DashboardClient data={data} initialLayout={layout} />
      ) : (
        <Card padding="spacious" className="max-w-2xl mx-auto">
          <p className="text-sm text-gray-400 text-center">
            Your schedule and upcoming shifts will appear here.
          </p>
        </Card>
      )}
    </div>
  );
}
