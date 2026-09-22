'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import {
  evaluate,
  canStepOut,
  isLeadFor,
  bandFor,
  BAND_LABEL,
  mixText,
  type Band,
  type Check,
} from '@kinderbase/core';
import { childDisplayName, ageInMonths, isAdmin, type CenterRole, type UpdateType } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function requireRoomMember(
  classroomId: string,
): Promise<{ service: Service; userId: string; role: CenterRole; centerId: string; roomName: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: room } = await service.from('classrooms').select('center_id, name').eq('id', classroomId).is('deleted_at', null).maybeSingle();
  if (!room) return null;
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', room.center_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null;
  return { service, userId: user.id, role: m.role as CenterRole, centerId: room.center_id, roomName: room.name };
}

function todayISO(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
function ageLabel(months: number): string {
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}y ${m}m` : `${y}y`;
}

export type MobileStaff = { id: string; name: string; leadForGroup: boolean; onBreak: boolean; isSelf: boolean };
export type MobileChild = { id: string; name: string; band: Band; bandLabel: string; ageLabel: string; updatesToday: number; present: boolean; allergy: boolean };
export type MobileRoom = {
  id: string;
  name: string;
  napState: 'awake' | 'settling' | 'resting';
  evaluation: {
    ok: boolean;
    status: 'ok' | 'at_minimum' | 'out';
    requiredNow: number;
    present: number;
    mixText: string;
    ruleName: string;
    citation: string;
    checks: Check[];
    leadPresent: boolean;
  };
  staff: MobileStaff[];
  children: MobileChild[];
  me: { staffId: string | null; onBreak: boolean; isAdmin: boolean; role: CenterRole };
};

export async function getMobileRoom(classroomId: string): Promise<MobileRoom | null> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) return null;
  const { service, userId, role } = ctx;
  const clock = getClock();
  const at = clock.now();
  const nowISO = at.toISOString();
  const today = todayISO(at);

  const input = await loadRoomInput(classroomId, clock, service);
  if (!input) return null;
  const e = evaluate(input);
  const hasUnderTwo = e.rule.hasUnderTwo;

  // Assigned staff now (including on-break, for display).
  const { data: assignments } = await service
    .from('staff_assignments')
    .select('user_id')
    .eq('classroom_id', classroomId)
    .lte('starts_at', nowISO)
    .gt('ends_at', nowISO);
  const assignedIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
  const { data: openBreaks } = assignedIds.length
    ? await service.from('staff_breaks').select('user_id').eq('classroom_id', classroomId).is('ended_at', null).in('user_id', assignedIds)
    : { data: [] as { user_id: string }[] };
  const onBreak = new Set((openBreaks ?? []).map((b) => b.user_id));
  const { data: users } = assignedIds.length ? await service.from('users').select('id, full_name').in('id', assignedIds) : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const { data: quals } = assignedIds.length
    ? await service.from('center_memberships').select('user_id, lead_qualified, infant_toddler_trained').eq('center_id', ctx.centerId).in('user_id', assignedIds).is('left_at', null)
    : { data: [] as { user_id: string; lead_qualified: boolean; infant_toddler_trained: boolean }[] };
  const qualById = new Map((quals ?? []).map((q) => [q.user_id, q]));
  const staff: MobileStaff[] = assignedIds.map((id) => {
    const q = qualById.get(id);
    return {
      id,
      name: nameById.get(id) ?? 'Staff',
      leadForGroup: isLeadFor({ id, leadQualified: q?.lead_qualified ?? false, infantToddlerTrained: q?.infant_toddler_trained ?? false }, hasUnderTwo),
      onBreak: onBreak.has(id),
      isSelf: id === userId,
    };
  });

  // Children roster.
  const { data: kids } = await service
    .from('children')
    .select('id, first_name, last_name, birthdate')
    .eq('classroom_id', classroomId)
    .eq('status', 'enrolled')
    .is('deleted_at', null)
    .order('first_name');
  const kidIds = (kids ?? []).map((k) => k.id);
  const noIds = ['00000000-0000-0000-0000-000000000000'];
  const { data: attendance } = await service.from('child_attendance').select('child_id, signed_in_at, signed_out_at').eq('classroom_id', classroomId).eq('attendance_date', today);
  const attByChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));
  const { data: updates } = await service.from('child_updates').select('child_update_children(child_id)').eq('classroom_id', classroomId).gte('created_at', `${today}T00:00:00`);
  const updatesByChild = new Map<string, number>();
  for (const u of updates ?? []) for (const t of (u.child_update_children ?? []) as { child_id: string }[]) updatesByChild.set(t.child_id, (updatesByChild.get(t.child_id) ?? 0) + 1);
  const { data: allergies } = await service.from('student_health').select('child_id').eq('severity', 'severe').in('child_id', kidIds.length ? kidIds : noIds);
  const allergySet = new Set((allergies ?? []).map((h) => h.child_id));

  const children: MobileChild[] = (kids ?? []).map((c) => {
    const att = attByChild.get(c.id);
    const dob = new Date(`${c.birthdate}T00:00:00`);
    const b = bandFor(dob, at);
    const months = ageInMonths(c.birthdate, at);
    return {
      id: c.id,
      name: childDisplayName(c),
      band: b,
      bandLabel: BAND_LABEL[b],
      ageLabel: ageLabel(months),
      updatesToday: updatesByChild.get(c.id) ?? 0,
      present: !!att?.signed_in_at && !att?.signed_out_at,
      allergy: allergySet.has(c.id),
    };
  });

  return {
    id: classroomId,
    name: ctx.roomName,
    napState: input.napState,
    evaluation: {
      ok: e.ok,
      status: e.status,
      requiredNow: e.requiredNow,
      present: input.staff.length,
      mixText: mixText(e.mix),
      ruleName: e.rule.name,
      citation: e.rule.citation,
      checks: e.checks,
      leadPresent: e.leadsPresent.length > 0,
    },
    staff,
    children,
    me: { staffId: assignedIds.includes(userId) ? userId : null, onBreak: onBreak.has(userId), isAdmin: isAdmin(role), role },
  };
}

export type FeedItem = { id: string; type: UpdateType; body: string; author: string; at: string; covering: boolean; children: string[] };

export async function getRoomFeed(classroomId: string, query?: string): Promise<FeedItem[]> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) return [];
  const { data } = await ctx.service
    .from('child_updates')
    .select('id, update_type, body, created_at, covering, users(full_name), child_update_children(children(first_name, last_name))')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
    .limit(60);
  const q = (query ?? '').trim().toLowerCase();
  return (data ?? [])
    .map((u) => {
      const author = Array.isArray(u.users) ? u.users[0] : u.users;
      const children = ((u.child_update_children ?? []) as { children: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }[])
        .map((t) => (Array.isArray(t.children) ? t.children[0] : t.children))
        .filter((c): c is { first_name: string; last_name: string } => !!c)
        .map((c) => childDisplayName(c));
      return { id: u.id, type: u.update_type as UpdateType, body: u.body, author: author?.full_name ?? 'Staff', at: u.created_at, covering: u.covering, children };
    })
    .filter((f) => !q || f.body.toLowerCase().includes(q) || f.children.some((c) => c.toLowerCase().includes(q)));
}

// ── mutations ────────────────────────────────────────────────────────────────
export async function logChildUpdate(classroomId: string, input: { childIds: string[]; type: UpdateType; body: string }): Promise<void> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) throw new Error('Forbidden');
  const { service, userId, role } = ctx;
  const body = input.body.trim() || `${input.type} logged`;
  const { data: update, error } = await service
    .from('child_updates')
    .insert({ classroom_id: classroomId, author_id: userId, update_type: input.type, body, covering: isAdmin(role) })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  if (input.childIds.length) {
    await service.from('child_update_children').insert(input.childIds.map((child_id) => ({ update_id: update.id, child_id })));
  }
  revalidatePath(`/m/classroom/${classroomId}`);
}

export async function setNapState(classroomId: string, state: 'awake' | 'settling' | 'resting'): Promise<void> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) throw new Error('Forbidden');
  const { error } = await ctx.service.from('classroom_nap_events').insert({ classroom_id: classroomId, state, set_by: ctx.userId });
  if (error) throw new Error(error.message);
  revalidatePath(`/m/classroom/${classroomId}`);
}

/** Take a break — refused (with plain-English reasons) if the room would fall out of ratio. */
export async function startBreak(classroomId: string, staffId?: string): Promise<{ ok: boolean; reasons?: string[]; hint?: string }> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) throw new Error('Forbidden');
  const { service, userId, role } = ctx;
  const target = staffId && isAdmin(role) ? staffId : userId; // teachers only break themselves
  const clock = getClock();
  const input = await loadRoomInput(classroomId, clock, service);
  if (!input) throw new Error('Room not found');
  const check = canStepOut(input, target);
  if (!check.allowed) return { ok: false, reasons: check.reasons, hint: check.hint };
  const snapshot = evaluate({ ...input, staff: input.staff.filter((s) => s.id !== target) });
  await service.from('staff_breaks').insert({ classroom_id: classroomId, user_id: target, started_at: clock.now().toISOString(), engine_snapshot: snapshot as unknown as Record<string, unknown> });
  revalidatePath(`/m/classroom/${classroomId}`);
  return { ok: true };
}

export async function endBreak(classroomId: string, staffId?: string): Promise<void> {
  const ctx = await requireRoomMember(classroomId);
  if (!ctx) throw new Error('Forbidden');
  const { service, userId, role } = ctx;
  const target = staffId && isAdmin(role) ? staffId : userId;
  await service.from('staff_breaks').update({ ended_at: getClock().now().toISOString() }).eq('classroom_id', classroomId).eq('user_id', target).is('ended_at', null);
  revalidatePath(`/m/classroom/${classroomId}`);
}
