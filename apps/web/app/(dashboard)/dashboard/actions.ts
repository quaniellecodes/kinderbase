'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, mixText } from '@kinderbase/core';
import { isAdmin, childDisplayName, type CenterRole } from '@kinderbase/types';
import { getAdminHome, type HeadsUp } from '@/app/(mobile)/m/admin/actions';
import { getApprovals, type Approval } from '@/app/(mobile)/m/admin/approvals-actions';
import { getAgingFamilyThreads } from '@/app/(mobile)/m/messages/actions';
import { getCenterDashboard } from '@/app/(dashboard)/classrooms/child-actions';
import { WIDGETS, defaultLayout, type WidgetKey, type WidgetLayoutRow } from './widgets';

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

// ── Widget layout persistence ────────────────────────────────────────────────
export async function getDashboardLayout(): Promise<WidgetLayoutRow[]> {
  const c = await requireAdmin();
  if (!c) return defaultLayout();
  const { data } = await c.service
    .from('dashboard_widgets')
    .select('widget_key, sort_order, span, visible')
    .eq('user_id', c.userId)
    .eq('center_id', c.centerId)
    .order('sort_order');
  const known = new Set(WIDGETS.map((w) => w.key));
  const rows = (data ?? []).filter((r) => known.has(r.widget_key as WidgetKey)) as WidgetLayoutRow[];
  return rows.length ? rows : defaultLayout();
}

export async function saveDashboardLayout(rows: WidgetLayoutRow[]): Promise<void> {
  const c = await requireAdmin();
  if (!c) throw new Error('Forbidden');
  const known = new Set(WIDGETS.map((w) => w.key));
  const clean = rows.filter((r) => known.has(r.widget_key as WidgetKey));
  // Replace the full set for this user+center.
  await c.service.from('dashboard_widgets').delete().eq('user_id', c.userId).eq('center_id', c.centerId);
  if (clean.length) {
    const { error } = await c.service.from('dashboard_widgets').insert(
      clean.map((r) => ({ user_id: c.userId, center_id: c.centerId, widget_key: r.widget_key, sort_order: r.sort_order, span: Math.min(3, Math.max(1, r.span)), visible: r.visible })),
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath('/dashboard');
}

/** Record a nudge to a teacher (mirrors the mobile heads-up nudge). */
export async function nudgeStaff(userId: string): Promise<void> {
  const c = await requireAdmin();
  if (!c) throw new Error('Forbidden');
  await c.service.from('activity_log').insert({ center_id: c.centerId, actor_id: c.userId, event_type: 'staff_nudged', payload: { user_id: userId } });
}

// ── Dashboard data ───────────────────────────────────────────────────────────
export type StripRoom = { id: string; name: string; status: 'ok' | 'at_minimum' | 'out'; ratio: string; present: number; required: number; children: number; mixText: string; ruleName: string; citation: string; leadOk: boolean };
export type NeedItem = { key: string; urgency: number; title: string; sub: string; kind: 'approval' | 'aging' | 'late'; refId?: string; plan?: boolean; href?: string };
export type AccRow = { userId: string; name: string; posts7d: number; last: string | null; tone: 'ok' | 'amber' | 'red' };
export type StaffToday = { key: string; name: string; sub: string; tone: 'ok' | 'amber' | 'gray'; badge?: string };
export type FeedRow = { id: string; author: string; room: string; body: string; at: string };

export type DirectorDashboard = {
  banner: { roomId: string; name: string; mixText: string; citation: string; required: number; present: number; missingLead: boolean; ageFix: { names: string[]; toRoomId: string; toRoom: string } | null } | null;
  moreOut: number;
  strip: StripRoom[];
  kpi: { staffOnFloor: number; staffScheduled: number; children: number; childrenEnrolled: number; compliant: number; roomsTotal: number; approvals: number; unanswered: number };
  needs: NeedItem[];
  heads: HeadsUp[];
  acc: AccRow[];
  staff: StaffToday[];
  approvals: Approval[];
  feed: FeedRow[];
};

const ratioText = (children: number, staff: number) => (staff ? `1:${Math.round(children / staff)}` : '—');

export async function getDirectorDashboard(): Promise<DirectorDashboard | null> {
  const c = await requireAdmin();
  if (!c) return null;
  const { service, centerId } = c;
  const clock = getClock();

  const [home, center, approvals, aging] = await Promise.all([getAdminHome(), getCenterDashboard(centerId), getApprovals(), getAgingFamilyThreads()]);
  if (!home) return null;

  // Room enrichment: one eval pass to add governing rule + citation + children count.
  const { data: classrooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null).order('name');
  const rooms = classrooms ?? [];
  const inputs = await Promise.all(rooms.map((r) => loadRoomInput(r.id, clock, service)));
  const strip: StripRoom[] = rooms.map((r, i) => {
    const input = inputs[i] ?? null;
    const e = input ? evaluate(input) : null;
    return {
      id: r.id,
      name: r.name,
      status: e?.status ?? 'ok',
      ratio: input ? ratioText(input.children.length, input.staff.length) : '—',
      present: input?.staff.length ?? 0,
      required: e?.requiredNow ?? 0,
      children: input?.children.length ?? 0,
      mixText: e ? mixText(e.mix) : 'no children',
      ruleName: e?.rule.name ?? '—',
      citation: e?.rule.citation ?? '—',
      leadOk: e ? !!e.checks.find((ck) => ck.key === 'lead')?.pass : true,
    };
  });

  // Late staff: rostered with a shift today but not clocked in.
  const roomIds = rooms.map((r) => r.id);
  const now = clock.now();
  const isoDow = ((now.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const { data: roster } = roomIds.length
    ? await service.from('classroom_staff').select('id, user_id, classroom_id, users(full_name)').in('classroom_id', roomIds)
    : { data: [] as { id: string; user_id: string | null; classroom_id: string; users: { full_name: string } | { full_name: string }[] | null }[] };
  const rosterIds = (roster ?? []).map((r) => r.id);
  const { data: shifts } = rosterIds.length ? await service.from('staff_shift_slots').select('classroom_staff_id').eq('day_of_week', isoDow).in('classroom_staff_id', rosterIds) : { data: [] as { classroom_staff_id: string }[] };
  const scheduledRosterIds = new Set((shifts ?? []).map((s) => s.classroom_staff_id));
  const { data: openEntries } = await service.from('time_entries').select('user_id').eq('center_id', centerId).is('clocked_out_at', null).gte('clocked_in_at', dayStart.toISOString());
  const presentUsers = new Set((openEntries ?? []).map((e) => e.user_id));
  const staff: StaffToday[] = [];
  const seenLate = new Set<string>();
  for (const r of roster ?? []) {
    if (!r.user_id || !scheduledRosterIds.has(r.id) || presentUsers.has(r.user_id) || seenLate.has(r.user_id)) continue;
    seenLate.add(r.user_id);
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    staff.push({ key: `late-${r.user_id}`, name: u?.full_name ?? 'Staff', sub: 'Scheduled today · not clocked in', tone: 'amber', badge: 'Late' });
  }
  const { data: subs } = await service.from('center_memberships').select('user_id, role, users(full_name)').eq('center_id', centerId).is('left_at', null).eq('role', 'substitute');
  for (const s of subs ?? []) {
    const u = Array.isArray(s.users) ? s.users[0] : s.users;
    staff.push({ key: `sub-${s.user_id}`, name: u?.full_name ?? 'Substitute', sub: 'Substitute · on call', tone: 'gray' });
  }

  // Accountability + feed: child_updates across the center over 7 days.
  const { data: updates } = roomIds.length
    ? await service
        .from('child_updates')
        .select('id, body, created_at, author_id, classroom_id, users(full_name), classrooms(name)')
        .in('classroom_id', roomIds)
        .gte('created_at', new Date(now.getTime() - 7 * 86_400_000).toISOString())
        .order('created_at', { ascending: false })
    : { data: [] as { id: string; body: string; created_at: string | null; author_id: string | null; classroom_id: string; users: { full_name: string } | { full_name: string }[] | null; classrooms: { name: string } | { name: string }[] | null }[] };
  const postsBy = new Map<string, { posts7d: number; last: string | null }>();
  for (const u of updates ?? []) {
    if (!u.author_id) continue;
    const e = postsBy.get(u.author_id) ?? { posts7d: 0, last: null };
    e.posts7d++;
    if (!e.last || (u.created_at ?? '') > e.last) e.last = u.created_at ?? null;
    postsBy.set(u.author_id, e);
  }
  // Teachers = center members who lead/assist (exclude admins/subs for accountability).
  const { data: teachers } = await service.from('center_memberships').select('user_id, role, users(full_name)').eq('center_id', centerId).is('left_at', null).in('role', ['lead_teacher', 'assistant_teacher', 'aide']);
  const acc: AccRow[] = (teachers ?? [])
    .map((t) => {
      const u = Array.isArray(t.users) ? t.users[0] : t.users;
      const stat = postsBy.get(t.user_id) ?? { posts7d: 0, last: null };
      const tone: AccRow['tone'] = stat.posts7d === 0 ? 'red' : stat.posts7d < 3 ? 'amber' : 'ok';
      return { userId: t.user_id, name: u?.full_name ?? 'Teacher', posts7d: stat.posts7d, last: stat.last, tone };
    })
    .sort((a, b) => a.posts7d - b.posts7d);
  const feed: FeedRow[] = (updates ?? []).slice(0, 6).map((u) => {
    const au = Array.isArray(u.users) ? u.users[0] : u.users;
    const rm = Array.isArray(u.classrooms) ? u.classrooms[0] : u.classrooms;
    return { id: u.id, author: au?.full_name ?? 'Staff', room: rm?.name ?? 'Room', body: u.body, at: u.created_at ?? '' };
  });

  // Needs ("Waiting on you"): approvals + aging families + late staff, urgency-sorted.
  const needs: NeedItem[] = [];
  for (const a of aging) needs.push({ key: `aging-${a.id}`, urgency: 0, title: `${a.childName}'s family has waited ${a.hours}h`, sub: `${a.room} · unanswered`, kind: 'aging', refId: a.id, href: `/m/messages/${a.id}` });
  for (const a of approvals) needs.push({ key: `ap-${a.id}`, urgency: a.kind === 'plan' ? 2 : 1, title: `${a.kind === 'plan' ? 'Lesson plan' : a.kind === 'leave' ? 'Leave' : a.kind === 'sched' ? 'Schedule change' : 'Time correction'} · ${a.who}`, sub: a.title + (a.meta ? ` — ${a.meta}` : ''), kind: 'approval', refId: a.id, plan: a.kind === 'plan' });
  for (const s of staff.filter((x) => x.tone === 'amber')) needs.push({ key: s.key, urgency: 1, title: `${s.name} is late`, sub: s.sub, kind: 'late', refId: s.key.replace('late-', '') });
  needs.sort((a, b) => a.urgency - b.urgency);

  return {
    banner: home.alert,
    moreOut: home.moreOut,
    strip,
    kpi: {
      staffOnFloor: home.stats.staffOnFloor,
      staffScheduled: center?.staffScheduled ?? home.stats.staffOnFloor,
      children: home.stats.children,
      childrenEnrolled: center?.childrenEnrolled ?? home.stats.children,
      compliant: home.stats.compliant,
      roomsTotal: home.stats.roomsTotal,
      approvals: home.approvals,
      unanswered: aging.length,
    },
    needs,
    heads: home.headsUp,
    acc,
    staff,
    approvals,
    feed,
  };
}
