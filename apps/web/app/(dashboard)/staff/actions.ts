'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin, type CenterRole } from '@kinderbase/types';

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function assertDirector(supabase: ReturnType<typeof createClient>, centerId: string) {
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
  return user;
}

export async function getStaff(centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const service = createServiceClient();

  const { data: memberships } = await service
    .from('center_memberships')
    .select('id, role, joined_at, users(id, full_name, email, kiosk_pin)')
    .eq('center_id', centerId)
    .is('left_at', null);

  // Get currently clocked-in user IDs
  const { data: openEntries } = await service
    .from('time_entries')
    .select('user_id')
    .eq('center_id', centerId)
    .is('clocked_out_at', null);

  const clockedInIds = new Set((openEntries ?? []).map(e => e.user_id));

  return (memberships ?? [])
    .map(m => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      if (!u) return null;
      return {
        membershipId: m.id,
        userId: u.id,
        full_name: u.full_name,
        email: u.email,
        role: m.role as CenterRole,
        joinedAt: m.joined_at,
        hasPin: !!u.kiosk_pin,
        isClockedIn: clockedInIds.has(u.id),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function searchUsers(query: string, centerId: string) {
  if (query.trim().length < 2) return [];

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const service = createServiceClient();

  // Find users matching the query who are NOT already members of this center
  const { data: existing } = await service
    .from('center_memberships')
    .select('user_id')
    .eq('center_id', centerId)
    .is('left_at', null);

  const existingIds = (existing ?? []).map(m => m.user_id);

  const { data } = await service
    .from('users')
    .select('id, full_name, email')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .is('deleted_at', null)
    .limit(10);

  return (data ?? []).filter(u => !existingIds.includes(u.id));
}

export async function addExistingStaff(userId: string, centerId: string, role: CenterRole) {
  const supabase = createClient();
  await assertDirector(supabase, centerId);

  const service = createServiceClient();

  // Auto-generate PIN if they don't have one
  const { data: u } = await service.from('users').select('kiosk_pin').eq('id', userId).single();
  if (!u?.kiosk_pin) {
    await service.from('users').update({ kiosk_pin: randomPin() }).eq('id', userId);
  }

  // Re-activate if they previously left, otherwise insert
  const { data: prev } = await service
    .from('center_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .not('left_at', 'is', null)
    .maybeSingle();

  if (prev) {
    await service
      .from('center_memberships')
      .update({ left_at: null, role, joined_at: new Date().toISOString() })
      .eq('id', prev.id);
  } else {
    await service
      .from('center_memberships')
      .insert({ user_id: userId, center_id: centerId, role });
  }

  revalidatePath('/staff');
}

export async function addManualStaff(
  centerId: string,
  full_name: string,
  email: string,
  role: CenterRole
) {
  const supabase = createClient();
  await assertDirector(supabase, centerId);

  const service = createServiceClient();

  // Check if a user with this email already exists
  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    // Create a stub user (no auth account yet — they can claim it later)
    const { data: newUser, error } = await service
      .from('users')
      .insert({
        id: crypto.randomUUID(),
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        kiosk_pin: randomPin(),
      })
      .select('id')
      .single();

    if (error || !newUser) throw new Error('Failed to create user');
    userId = newUser.id;
  }

  await addExistingStaff(userId, centerId, role);
  revalidatePath('/staff');
}

export async function updateStaffRole(membershipId: string, centerId: string, role: CenterRole) {
  const supabase = createClient();
  await assertDirector(supabase, centerId);

  const service = createServiceClient();
  await service.from('center_memberships').update({ role }).eq('id', membershipId);
  revalidatePath('/staff');
}

export async function removeStaff(membershipId: string, centerId: string) {
  const supabase = createClient();
  await assertDirector(supabase, centerId);

  const service = createServiceClient();
  await service
    .from('center_memberships')
    .update({ left_at: new Date().toISOString() })
    .eq('id', membershipId);

  revalidatePath('/staff');
}
