import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { ActivityFeed } from '@/components/activity/ActivityFeed';

async function getDashboardStats(centerId: string) {
  const supabase = createClient();

  const [{ count: staffPresent }, { count: classroomCount }, { data: recentActivity }] =
    await Promise.all([
      supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('center_id', centerId)
        .is('clocked_out_at', null),
      supabase
        .from('classrooms')
        .select('*', { count: 'exact', head: true })
        .eq('center_id', centerId)
        .is('deleted_at', null),
      supabase
        .from('activity_log')
        .select('id, event_type, payload, created_at')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

  return {
    staffPresent: staffPresent ?? 0,
    classroomCount: classroomCount ?? 0,
    recentActivity: recentActivity ?? [],
  };
}

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
  const stats = admin ? await getDashboardStats(active.centerId) : null;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">{greeting}, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{active.centerName}</p>
      </div>

      {admin && stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-card border border-gray-100 p-4">
              <p className="text-2xl font-medium text-gray-900">{stats.staffPresent}</p>
              <p className="text-xs text-gray-500 mt-1">Staff present</p>
            </div>
            <div className="bg-white rounded-card border border-gray-100 p-4">
              <p className="text-2xl font-medium text-gray-900">{stats.classroomCount}</p>
              <p className="text-xs text-gray-500 mt-1">Classrooms</p>
            </div>
          </div>

          <div className="bg-white rounded-card border border-gray-100 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-900 mb-1">Recent activity</h2>
            <ActivityFeed entries={stats.recentActivity} />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-card border border-gray-100 p-6">
          <p className="text-sm text-gray-400 text-center">
            Your schedule and upcoming shifts will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
