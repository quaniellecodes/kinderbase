'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin, type StaffRequestType, type StaffRequestStatus } from '@kinderbase/types';

export type RequestRow = {
  id: string;
  type: StaffRequestType;
  status: StaffRequestStatus;
  details: string | null;
  forDate: string | null;
  createdAt: string;
  staffName: string;
};

export async function getRequests(): Promise<{ rows: RequestRow[]; admin: boolean } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ctx = getActiveContextFromCookies();
  if (!ctx) return null;

  const service = createServiceClient();
  const admin = isAdmin(ctx.role);

  let query = service
    .from('staff_requests')
    .select('id, type, status, details, for_date, created_at, user_id')
    .eq('center_id', ctx.centerId)
    .order('created_at', { ascending: false });
  if (!admin) query = query.eq('user_id', user.id);
  const { data } = await query;
  const rows = data ?? [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = userIds.length
    ? await service.from('users').select('id, full_name').in('id', userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  return {
    admin,
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type as StaffRequestType,
      status: r.status as StaffRequestStatus,
      details: r.details,
      forDate: r.for_date,
      createdAt: r.created_at,
      staffName: nameById.get(r.user_id) ?? 'Staff',
    })),
  };
}

export async function createOwnRequest(type: StaffRequestType, details: string, forDate?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  const ctx = getActiveContextFromCookies();
  if (!ctx) throw new Error('No active center');

  const service = createServiceClient();
  await service.from('staff_requests').insert({
    user_id: user.id, center_id: ctx.centerId, type,
    details: details.trim() || null, for_date: forDate ?? null, created_by: user.id,
  });
  revalidatePath('/requests');
}

export async function resolveRequest(id: string, status: 'approved' | 'rejected') {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  const ctx = getActiveContextFromCookies();
  if (!ctx || !isAdmin(ctx.role)) throw new Error('Forbidden');

  const service = createServiceClient();
  await service.from('staff_requests').update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('center_id', ctx.centerId);
  revalidatePath('/requests');
}
