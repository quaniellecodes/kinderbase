'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isAdmin } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function requireAdmin(): Promise<{ service: Service; centerId: string; userId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), centerId: active.centerId, userId: user.id };
}

export type Approval = {
  id: string;
  kind: 'time' | 'leave' | 'sched' | 'plan';
  who: string;
  when: string;
  title: string;
  detail: string;
  meta?: string; // e.g. for-date or coverage warning
};

const REQ_LABEL: Record<string, Approval['kind']> = { time_correction: 'time', leave: 'leave', schedule: 'sched' };

export async function getApprovals(): Promise<Approval[]> {
  const ctx = await requireAdmin();
  if (!ctx) return [];
  const { service, centerId } = ctx;

  const { data: reqs } = await service
    .from('staff_requests')
    .select('id, type, for_date, details, created_at, users!staff_requests_user_id_fkey(full_name)')
    .eq('center_id', centerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // For leave, flag if the requester is a room lead (their room will need a cover).
  const leadUserIds = new Set<string>();
  const { data: leads } = await service.from('classroom_staff').select('user_id, classrooms(center_id)').not('user_id', 'is', null);
  for (const l of leads ?? []) {
    const c = Array.isArray(l.classrooms) ? l.classrooms[0] : l.classrooms;
    if ((c as { center_id: string } | null)?.center_id === centerId && l.user_id) leadUserIds.add(l.user_id);
  }

  const reqApprovals: Approval[] = (reqs ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const kind = REQ_LABEL[r.type] ?? 'sched';
    return {
      id: `req:${r.id}`,
      kind,
      who: u?.full_name ?? 'Staff',
      when: r.created_at ?? '',
      title: kind === 'time' ? 'Time correction' : kind === 'leave' ? 'Leave request' : 'Schedule change',
      detail: r.details ?? '',
      meta: [r.for_date ?? '', kind === 'leave' ? 'Coverage may be needed for their room' : ''].filter(Boolean).join(' · ') || undefined,
    };
  });

  const { data: rooms } = await service.from('classrooms').select('id').eq('center_id', centerId).is('deleted_at', null);
  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: plans } = roomIds.length
    ? await service
        .from('lesson_plans')
        .select('id, week_of, submitted_at, classrooms(name), users!lesson_plans_submitted_by_fkey(full_name)')
        .in('classroom_id', roomIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
    : { data: [] as never[] };
  const planApprovals: Approval[] = (plans ?? []).map((p) => {
    const room = Array.isArray(p.classrooms) ? p.classrooms[0] : p.classrooms;
    const u = Array.isArray(p.users) ? p.users[0] : p.users;
    return { id: `plan:${p.id}`, kind: 'plan', who: u?.full_name ?? 'Lead', when: p.submitted_at ?? '', title: `Lesson plan · ${(room as { name: string } | null)?.name ?? ''}`, detail: `Week of ${p.week_of} · 20 of 20 blocks`, meta: undefined };
  });

  return [...planApprovals, ...reqApprovals];
}

export async function resolveApproval(id: string, decision: 'approved' | 'rejected' | 'returned', comment?: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!ctx) throw new Error('Forbidden');
  const { service, userId } = ctx;
  const now = getClock().now().toISOString();
  const [kind, realId] = id.split(':');

  if (kind === 'req') {
    await service.from('staff_requests').update({ status: decision === 'returned' ? 'rejected' : decision, resolved_at: now }).eq('id', realId);
  } else if (kind === 'plan') {
    const status = decision === 'approved' ? 'approved' : 'returned';
    await service.from('lesson_plans').update({ status, reviewed_by: userId, reviewed_at: now, review_comment: comment ?? null }).eq('id', realId);
  }
  revalidatePath('/m/admin/inbox');
  revalidatePath('/m/admin');
}
