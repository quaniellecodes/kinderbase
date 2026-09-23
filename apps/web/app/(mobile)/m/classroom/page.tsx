import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getClock } from '@/lib/clock';
import { activeClassroomFor } from '@/lib/staffing/room-state';
import { Card, EmptyState } from '@/components/ui';
import { DoorOpen } from 'lucide-react';

/** Resolve the active classroom (assignment now → manual override → admin default) and go there. */
export default async function ClassroomIndex() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clock = getClock();
  let roomId = await activeClassroomFor(user.id, clock);

  if (!roomId) {
    const override = cookies().get('kb_active_room')?.value;
    if (override) roomId = override;
  }
  if (!roomId && isAdmin(active.role)) {
    const service = createServiceClient();
    const { data } = await service
      .from('classrooms')
      .select('id')
      .eq('center_id', active.centerId)
      .is('deleted_at', null)
      .order('name')
      .limit(1)
      .maybeSingle();
    roomId = data?.id ?? null;
  }

  if (roomId) redirect(`/m/classroom/${roomId}`);

  return (
    <div className="p-4">
      <Card padding="none">
        <EmptyState
          icon={<DoorOpen className="w-8 h-8" />}
          title="No active classroom"
          description="You're not assigned to a room right now. You'll be notified when you're assigned."
        />
      </Card>
    </div>
  );
}
