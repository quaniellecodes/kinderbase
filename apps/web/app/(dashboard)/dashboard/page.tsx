import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getCenterDashboard } from '@/app/(dashboard)/classrooms/child-actions';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui';
import { OutOfRatioBanner } from '@/components/dashboard/OutOfRatioBanner';
import { ClassroomRatioList } from '@/components/dashboard/ClassroomRatioList';

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
  const data = admin ? await getCenterDashboard(active.centerId) : null;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">{greeting}, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{active.centerName}</p>
      </div>

      {admin && data ? (
        <div>
          <OutOfRatioBanner rooms={data.rooms} />

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard
              label="Staff present"
              value={data.staffPresent}
              sub={`of ${data.staffScheduled} scheduled`}
            />
            <StatCard
              label="Children signed in"
              value={data.childrenSignedIn}
              sub={`of ${data.childrenEnrolled} enrolled`}
            />
            <StatCard
              label="Rooms in ratio"
              value={`${data.roomsInRatio} of ${data.roomsTotal}`}
              tone={data.roomsInRatio === data.roomsTotal ? 'green' : 'red'}
            />
          </div>

          <h2 className="text-sm font-medium text-gray-900 mb-2">Classrooms</h2>
          <ClassroomRatioList rooms={data.rooms} />
        </div>
      ) : (
        <Card padding="spacious">
          <p className="text-sm text-gray-400 text-center">
            Your schedule and upcoming shifts will appear here.
          </p>
        </Card>
      )}
    </div>
  );
}
