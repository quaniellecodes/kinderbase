'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
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
