'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

export async function clockIn(centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  // Prevent double clock-in
  const { data: open } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .maybeSingle();

  if (open) return { error: 'Already clocked in' };

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ user_id: user.id, center_id: centerId })
    .select()
    .single();

  if (error) throw error;

  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  await logActivity(centerId, 'staff.clocked_in', { name: profile?.full_name ?? 'Staff' });

  revalidatePath('/time');
  return { entry: data };
}

export async function clockOut(entryId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('time_entries')
    .update({ clocked_out_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  const ms = new Date().getTime() - new Date(data.clocked_in_at).getTime();
  const mins = Math.floor(ms / 60000);
  const duration = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  await logActivity(data.center_id, 'staff.clocked_out', { name: profile?.full_name ?? 'Staff', duration });

  revalidatePath('/time');
  return { entry: data };
}

export async function updateTimeEntry(
  entryId: string,
  clockedInAt: string,
  clockedOutAt: string | null
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  // Only directors/admins can edit any entry; verify role
  const { data: entry } = await supabase
    .from('time_entries')
    .select('center_id')
    .eq('id', entryId)
    .single();
  if (!entry) throw new Error('Entry not found');

  const { data: membership } = await supabase
    .from('center_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('center_id', entry.center_id)
    .in('role', ['director', 'admin'])
    .is('left_at', null)
    .maybeSingle();
  if (!membership) throw new Error('Not authorized');

  await supabase
    .from('time_entries')
    .update({ clocked_in_at: clockedInAt, clocked_out_at: clockedOutAt })
    .eq('id', entryId);

  revalidatePath('/time');
}

export async function getActiveEntry(centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .maybeSingle();

  return data ?? null;
}

export async function getTimeEntries(centerId: string, isAdmin: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const select = 'id, user_id, center_id, clocked_in_at, clocked_out_at, notes, created_at';

  if (isAdmin) {
    const { data } = await supabase
      .from('time_entries')
      .select(`${select}, users(full_name)`)
      .eq('center_id', centerId)
      .order('clocked_in_at', { ascending: false })
      .limit(50);
    return data ?? [];
  }

  const { data } = await supabase
    .from('time_entries')
    .select(select)
    .eq('center_id', centerId)
    .eq('user_id', user.id)
    .order('clocked_in_at', { ascending: false })
    .limit(50);
  return data ?? [];
}
