'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { formatWeekOf } from '@/lib/format';
import { isAdmin } from '@kinderbase/types';
import { applyChangeRequest } from '@/lib/change-requests';

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
  kind: 'time' | 'leave' | 'sched' | 'plan' | 'profile';
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
        .select('id, week_of, submitted_at, classroom_id, classrooms(name), users!lesson_plans_submitted_by_fkey(full_name)')
        .in('classroom_id', roomIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
    : { data: [] as never[] };
  // One approval per (classroom, week) — collapse any duplicate submissions so the
  // Inbox doesn't show three identical rows (10 §2). Ordered newest-first above.
  const seenPlan = new Set<string>();
  const planApprovals: Approval[] = (plans ?? [])
    .filter((p) => {
      const k = `${p.classroom_id}|${p.week_of}`;
      if (seenPlan.has(k)) return false;
      seenPlan.add(k);
      return true;
    })
    .map((p) => {
      const room = Array.isArray(p.classrooms) ? p.classrooms[0] : p.classrooms;
      const u = Array.isArray(p.users) ? p.users[0] : p.users;
      // Title names the classroom (what you decide on); the teacher is context on
      // the detail line, and the date is formatted — never a raw ISO string.
      return { id: `plan:${p.id}`, kind: 'plan', who: u?.full_name ?? 'Lead', when: p.submitted_at ?? '', title: `Lesson plan · ${(room as { name: string } | null)?.name ?? ''}`, detail: `${formatWeekOf(p.week_of)} · ${u?.full_name ?? 'Lead'}`, meta: undefined };
    });

  // Parent-proposed profile changes (family app) — surfaced here so the existing
  // approvals count/badge is the admin's notification.
  const { data: changes } = await service
    .from('change_requests')
    .select('id, label, old_value, new_value, severity, apply_to_all, created_at, children(first_name, preferred_name, last_name), users!change_requests_requested_by_fkey(full_name)')
    .eq('center_id', centerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  const profileApprovals: Approval[] = (changes ?? []).map((r) => {
    const ch = Array.isArray(r.children) ? r.children[0] : r.children;
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const childName = ch ? `${(ch as { preferred_name: string | null; first_name: string }).preferred_name ?? (ch as { first_name: string }).first_name} ${(ch as { last_name: string }).last_name}`.trim() : 'Child';
    const scopeNote = r.apply_to_all ? 'Applies to all their children' : undefined;
    return {
      id: `profile:${r.id}`,
      kind: 'profile',
      who: u?.full_name ?? 'Parent',
      when: r.created_at ?? '',
      title: `${childName} · ${r.label}`,
      detail: `${r.old_value ?? '—'} → ${r.new_value ?? 'Remove'}`,
      meta: [r.severity === 'major' ? 'Major change — review carefully' : null, scopeNote].filter(Boolean).join(' · ') || undefined,
    };
  });

  return [...profileApprovals, ...planApprovals, ...reqApprovals];
}

export async function resolveApproval(id: string, decision: 'approved' | 'rejected' | 'returned', comment?: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!ctx) throw new Error('Forbidden');
  const { service, centerId, userId } = ctx;
  const now = getClock().now().toISOString();
  const [kind, realId] = id.split(':');
  if (!realId) throw new Error('Bad approval id');

  if (kind === 'req') {
    // Scope to the caller's center — the service client bypasses RLS, so a raw
    // id (exposed to the client) must not let an admin touch another center's row.
    const { error } = await service.from('staff_requests').update({ status: decision === 'returned' ? 'rejected' : decision, resolved_at: now }).eq('id', realId).eq('center_id', centerId);
    if (error) throw new Error(error.message);
  } else if (kind === 'plan') {
    const status = decision === 'approved' ? 'approved' : 'returned';
    // Plans have no center_id; verify the plan's classroom belongs to this center.
    const { data: rooms } = await service.from('classrooms').select('id').eq('center_id', centerId).is('deleted_at', null);
    const roomIds = (rooms ?? []).map((r) => r.id);
    if (!roomIds.length) throw new Error('Forbidden');
    const { error } = await service.from('lesson_plans').update({ status, reviewed_by: userId, reviewed_at: now, review_comment: comment ?? null }).eq('id', realId).in('classroom_id', roomIds);
    if (error) throw new Error(error.message);
  } else if (kind === 'profile') {
    // Approving a family profile change APPLIES it. Center-scope the lookup (service
    // client bypasses RLS + client-supplied id), then write the whitelisted field.
    const { data: req } = await service.from('change_requests').select('id, child_id, field_key, target_id, apply_value, apply_to_all, requested_by').eq('id', realId).eq('center_id', centerId).eq('status', 'pending').maybeSingle();
    if (!req) throw new Error('Not found');
    const approved = decision === 'approved';
    if (approved) {
      // Fans out to the requester's own children only when they chose "all my children".
      await applyChangeRequest(service, { child_id: req.child_id, field_key: req.field_key, target_id: req.target_id, apply_value: req.apply_value, apply_to_all: req.apply_to_all, requested_by: req.requested_by });
    }
    const { error } = await service.from('change_requests').update({ status: approved ? 'approved' : 'rejected', reviewed_by: userId, reviewed_at: now, review_note: comment ?? null }).eq('id', realId).eq('center_id', centerId);
    if (error) throw new Error(error.message);
    await service.from('activity_log').insert({ center_id: centerId, actor_id: userId, event_type: approved ? 'profile.change_approved' : 'profile.change_denied', payload: { request: realId, field: req.field_key } });
    revalidatePath('/p', 'layout');
  }
  revalidatePath('/m/admin/inbox');
  revalidatePath('/m/admin');
}
