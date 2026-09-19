'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function kioskLookupPin(pin: string, centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const service = createServiceClient();

  // Find the staff member with this PIN who belongs to this center
  const { data: memberships } = await service
    .from('center_memberships')
    .select('users(id, full_name, kiosk_pin)')
    .eq('center_id', centerId)
    .is('left_at', null);

  if (!memberships) return null;

  for (const m of memberships) {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    if (!u || u.kiosk_pin !== pin) continue;

    const { data: open } = await service
      .from('time_entries')
      .select('id')
      .eq('user_id', u.id)
      .eq('center_id', centerId)
      .is('clocked_out_at', null)
      .maybeSingle();

    return { id: u.id, full_name: u.full_name, isClockedIn: !!open };
  }

  return null;
}

export async function kioskClockIn(staffUserId: string, centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  // Caller must be a director/admin of this center
  const { data: membership } = await supabase
    .from('center_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('center_id', centerId)
    .in('role', ['director', 'admin'])
    .is('left_at', null)
    .maybeSingle();

  if (!membership) throw new Error('Not authorized');

  const service = createServiceClient();

  const { data: open } = await service
    .from('time_entries')
    .select('id')
    .eq('user_id', staffUserId)
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .maybeSingle();

  if (open) return { error: 'Already clocked in' as const };

  const { data } = await service
    .from('time_entries')
    .insert({ user_id: staffUserId, center_id: centerId })
    .select()
    .single();

  await service.from('activity_log').insert({
    center_id: centerId,
    actor_id: staffUserId,
    event_type: 'staff.clocked_in',
    payload: { source: 'kiosk' },
  });

  return { entry: data };
}

export async function kioskClockOut(staffUserId: string, centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: membership } = await supabase
    .from('center_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('center_id', centerId)
    .in('role', ['director', 'admin'])
    .is('left_at', null)
    .maybeSingle();

  if (!membership) throw new Error('Not authorized');

  const service = createServiceClient();

  const { data: open } = await service
    .from('time_entries')
    .select('id')
    .eq('user_id', staffUserId)
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .maybeSingle();

  if (!open) return { error: 'Not clocked in' as const };

  const { data } = await service
    .from('time_entries')
    .update({ clocked_out_at: new Date().toISOString() })
    .eq('id', open.id)
    .select()
    .single();

  await service.from('activity_log').insert({
    center_id: centerId,
    actor_id: staffUserId,
    event_type: 'staff.clocked_out',
    payload: { source: 'kiosk' },
  });

  return { entry: data };
}
