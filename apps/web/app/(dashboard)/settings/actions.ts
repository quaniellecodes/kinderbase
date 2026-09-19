'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { uploadOrgIcon, getOrgIconPublicUrl } from '@/lib/storage/org-icons';

export async function updateBrandColor(orgId: string, color: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase.from('organizations').update({ primary_color: color }).eq('id', orgId);
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
}

export async function uploadIcon(orgId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) throw new Error('No file provided');
  if (file.size > 2 * 1024 * 1024) throw new Error('Icon must be under 2MB');

  const path = await uploadOrgIcon(orgId, file);

  const service = createServiceClient();
  await service.from('organizations').update({ icon_path: path }).eq('id', orgId);

  revalidatePath('/', 'layout');
  return { url: getOrgIconPublicUrl(path) };
}

export async function removeIcon(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const service = createServiceClient();
  await service.from('organizations').update({ icon_path: null }).eq('id', orgId);
  revalidatePath('/', 'layout');
}

export async function getStaffPins(centerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const service = createServiceClient();
  const { data } = await service
    .from('center_memberships')
    .select('users(id, full_name, kiosk_pin)')
    .eq('center_id', centerId)
    .is('left_at', null);

  if (!data) return [];

  return data
    .map(m => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return { id: u?.id ?? '', full_name: u?.full_name ?? '', kiosk_pin: u?.kiosk_pin ?? null };
    })
    .filter(s => s.id && s.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function setStaffPin(userId: string, pin: string | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  if (pin !== null && !/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');

  const service = createServiceClient();
  await service.from('users').update({ kiosk_pin: pin }).eq('id', userId);
}

export async function getCenterHours(centerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('centers')
    .select('open_slot, close_slot, operating_days')
    .eq('id', centerId)
    .single();
  return {
    openSlot: data?.open_slot ?? 12,
    closeSlot: data?.close_slot ?? 38,
    operatingDays: data?.operating_days ?? [1, 2, 3, 4, 5],
  };
}

export async function updateCenterHours(
  centerId: string,
  openSlot: number,
  closeSlot: number,
  operatingDays: number[]
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const ctx = getActiveContextFromCookies();
  if (!ctx || !isAdmin(ctx.role) || ctx.centerId !== centerId) throw new Error('Forbidden');

  if (openSlot < 0 || closeSlot > 48 || openSlot >= closeSlot) {
    throw new Error('Invalid hours');
  }
  const days = [...new Set(operatingDays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 0) throw new Error('Select at least one operating day');

  const service = createServiceClient();
  await service
    .from('centers')
    .update({ open_slot: openSlot, close_slot: closeSlot, operating_days: days })
    .eq('id', centerId);

  revalidatePath('/settings');
  revalidatePath('/classrooms', 'layout');
}

export async function getOrgSettings(centerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('centers')
    .select('id, organizations(id, name, primary_color, icon_path)')
    .eq('id', centerId)
    .single();

  if (!data) return null;
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  return {
    centerId: data.id,
    orgId: org?.id ?? '',
    orgName: org?.name ?? '',
    primaryColor: org?.primary_color ?? '#D35400',
    iconUrl: org?.icon_path ? getOrgIconPublicUrl(org.icon_path) : null,
  };
}
