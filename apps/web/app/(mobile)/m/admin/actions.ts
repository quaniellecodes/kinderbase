'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, nextAgeTransition, suggestAgeMixFix, isLeadFor, mixText, BAND_LABEL, type RoomInput, type Evaluation, type Staff } from '@kinderbase/core';
import { getAgingFamilyThreads } from '@/app/(mobile)/m/messages/actions';
import { getApprovals } from '@/app/(mobile)/m/admin/approvals-actions';
import { isAdmin, computeCredentialStatus, childDisplayName, type CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function requireAdmin(): Promise<{ service: Service; centerId: string; centerName: string; role: CenterRole; userId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), centerId: active.centerId, centerName: active.centerName, role: active.role, userId: user.id };
}

export type AdminRoom = { id: string; name: string; status: 'ok' | 'at_minimum' | 'out'; ratio: string; required: number; present: number; children: number; mixText: string; staffNames: string };
export type HeadsUp = { key: string; title: string; sub: string; badge?: string; tone: 'red' | 'amber' | 'green'; href?: string; avatar?: string; nudgeUserId?: string };
export type ApprovalLite = { id: string; kind: 'time' | 'leave' | 'sched' | 'plan'; who: string; detail: string };
export type StaffTodayRow = { key: string; name: string; sub: string; badge?: string; tone: 'ok' | 'amber' | 'gray' };
export type AdminHome = {
  centerName: string;
  roleLabel: string;
  licensed: number;
  alert:
    | { roomId: string; name: string; mixText: string; citation: string; required: number; present: number; missingLead: boolean; ageFix: { names: string[]; toRoomId: string; toRoom: string } | null }
    | null;
  moreOut: number;
  stats: { staffOnFloor: number; staffScheduled: number; children: number; childrenEnrolled: number; compliant: number; roomsTotal: number };
  approvals: number;
  approvalsTop: ApprovalLite[];
  rooms: AdminRoom[];
  headsUp: HeadsUp[];
  staffToday: StaffTodayRow[];
};

const ratioText = (children: number, staff: number) => (staff ? `1:${Math.round(children / staff)}` : '—');
const initialsOf = (full: string) => full.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const surnameOf = (full: string) => full.trim().split(' ').slice(-1)[0] ?? full;

export async function getAdminHome(): Promise<AdminHome | null> {
  const ctx = await requireAdmin();
  if (!ctx) return null;
  const { service, centerId, centerName, role } = ctx;
  const clock = getClock();
  const now = clock.now();

  const { data: center } = await service.from('centers').select('licensed_capacity').eq('id', centerId).maybeSingle();
  const { data: classrooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null).order('name');
  const rooms = classrooms ?? [];
  const roomIds = rooms.map((r) => r.id);
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
  const inputs = await Promise.all(rooms.map((r) => loadRoomInput(r.id, clock, service)));
  const evals: { id: string; name: string; input: RoomInput | null; e: Evaluation | null }[] = rooms.map((r, i) => ({
    id: r.id,
    name: r.name,
    input: inputs[i] ?? null,
    e: inputs[i] ? evaluate(inputs[i]!) : null,
  }));
  const inputById: Record<string, RoomInput> = {};
  for (const ev of evals) if (ev.input) inputById[ev.id] = ev.input;

  // Staff names for each room (who's on the floor now).
  const floorIds = [...new Set(evals.flatMap((ev) => ev.input?.staff.map((s) => s.id) ?? []))];
  const { data: floorUsers } = floorIds.length ? await service.from('users').select('id, full_name').in('id', floorIds) : { data: [] as { id: string; full_name: string }[] };
  const floorNameById = new Map((floorUsers ?? []).map((u) => [u.id, u.full_name]));
  const staffNamesOf = (ev: (typeof evals)[number]) => (ev.input && ev.input.staff.length ? ev.input.staff.map((s) => surnameOf(floorNameById.get(s.id) ?? 'Staff')).join(' · ') : 'No staff');

  const adminRooms: AdminRoom[] = evals.map((ev) => ({
    id: ev.id,
    name: ev.name,
    status: ev.e?.status ?? 'ok',
    ratio: ev.input ? ratioText(ev.input.children.length, ev.input.staff.length) : '—',
    required: ev.e?.requiredNow ?? 0,
    present: ev.input?.staff.length ?? 0,
    children: ev.input?.children.length ?? 0,
    mixText: ev.e ? mixText(ev.e.mix) : 'no children',
    staffNames: staffNamesOf(ev),
  }));

  const outRooms = evals.filter((ev) => ev.e?.status === 'out');
  let alert: AdminHome['alert'] = null;
  if (outRooms[0]) {
    const w = outRooms[0];
    const e = w.e!;
    let ageFix: { names: string[]; toRoomId: string; toRoom: string } | null = null;
    const others = Object.fromEntries(Object.entries(inputById).filter(([id]) => id !== w.id));
    const fix = w.input ? suggestAgeMixFix(w.input, others) : null;
    if (fix) {
      const { data: movers } = await service.from('children').select('id, first_name, last_name').in('id', fix.move);
      const toName = evals.find((x) => x.id === fix.to)?.name ?? 'another room';
      ageFix = { names: (movers ?? []).map((m) => childDisplayName(m)), toRoomId: fix.to, toRoom: toName };
    }
    alert = { roomId: w.id, name: w.name, mixText: mixText(e.mix), citation: e.rule.citation, required: e.requiredNow, present: w.input?.staff.length ?? 0, missingLead: !e.checks.find((c) => c.key === 'lead')?.pass, ageFix };
  }

  // Approvals (list + count) — shared with the Inbox resolver.
  const approvalsAll = await getApprovals();
  const KIND_LABEL: Record<ApprovalLite['kind'], string> = { time: 'Time correction', leave: 'Leave', sched: 'Schedule change', plan: 'Lesson plan' };
  const approvalsTop: ApprovalLite[] = approvalsAll.slice(0, 3).map((a) => ({ id: a.id, kind: a.kind, who: a.who, detail: a.meta || a.detail || a.title }));

  // ── Heads up ──
  const headsUp: HeadsUp[] = [];

  // Accountability: the teacher who has gone longest without posting to families.
  const { data: teacherMembers } = await service.from('center_memberships').select('user_id, users(full_name)').eq('center_id', centerId).is('left_at', null).in('role', ['lead_teacher', 'assistant_teacher', 'aide']);
  const { data: posts } = roomIds.length
    ? await service.from('child_updates').select('author_id, created_at').in('classroom_id', roomIds).gte('created_at', new Date(now.getTime() - 30 * 86_400_000).toISOString())
    : { data: [] as { author_id: string | null; created_at: string | null }[] };
  const postStat = new Map<string, { count: number; last: number }>();
  for (const p of posts ?? []) {
    if (!p.author_id) continue;
    const s = postStat.get(p.author_id) ?? { count: 0, last: 0 };
    s.count++;
    const t = p.created_at ? new Date(p.created_at).getTime() : 0;
    if (t > s.last) s.last = t;
    postStat.set(p.author_id, s);
  }
  const { data: teacherRoster } = roomIds.length ? await service.from('classroom_staff').select('user_id, classroom_id').in('classroom_id', roomIds) : { data: [] as { user_id: string | null; classroom_id: string }[] };
  const roomOfUser = new Map<string, string>();
  for (const r of teacherRoster ?? []) if (r.user_id && !roomOfUser.has(r.user_id)) roomOfUser.set(r.user_id, roomNameById.get(r.classroom_id) ?? '');
  let worst: { userId: string; name: string; count: number; days: number } | null = null;
  for (const m of teacherMembers ?? []) {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    const s = postStat.get(m.user_id);
    const days = s && s.last ? Math.floor((now.getTime() - s.last) / 86_400_000) : 99;
    const count = s?.count ?? 0;
    if (!worst || count < worst.count || (count === worst.count && days > worst.days)) worst = { userId: m.user_id, name: u?.full_name ?? 'A teacher', count, days };
  }
  if (worst && (worst.count <= 2 || worst.days >= 7)) {
    const room = roomOfUser.get(worst.userId);
    headsUp.push({
      key: 'acc',
      title: worst.days >= 99 ? `${worst.name.split(' ')[0]} hasn't posted recently` : `${worst.name.split(' ')[0]} hasn't posted in ${worst.days} days`,
      sub: `${room ? room + ' · ' : ''}${worst.count} post${worst.count === 1 ? '' : 's'} this period`,
      tone: 'amber',
      avatar: initialsOf(worst.name),
      nudgeUserId: worst.userId,
    });
  }

  // Age transitions — every room with a child crossing a band soon.
  for (const ev of evals) {
    if (!ev.input) continue;
    const t = nextAgeTransition(ev.input);
    if (!t) continue;
    const { data: child } = await service.from('children').select('first_name, last_name').eq('id', t.childId).maybeSingle();
    const name = child ? childDisplayName(child) : 'A child';
    headsUp.push({ key: `age-${t.childId}`, title: `${name.split(' ')[0]} becomes a ${BAND_LABEL[t.to]} in ${t.inDays} days`, sub: `${ev.name} will need ${t.after.minStaff} staff (now ${t.before.minStaff})`, badge: `${t.inDays}d`, tone: 'amber', avatar: initialsOf(name) });
  }

  const { data: memberIds } = await service.from('center_memberships').select('user_id').eq('center_id', centerId).is('left_at', null);
  const ids = (memberIds ?? []).map((s) => s.user_id);
  if (ids.length) {
    const { data: creds } = await service.from('credentials').select('expires_at').in('user_id', ids).is('deleted_at', null);
    const exp = (creds ?? []).filter((c) => ['expiring_soon', 'expired'].includes(computeCredentialStatus(c.expires_at))).length;
    if (exp) headsUp.push({ key: 'cred', title: `${exp} credential${exp > 1 ? 's' : ''} expire this month`, sub: 'Staff renewals due', badge: String(exp), tone: 'red' });
  }
  const { count: missingDocs } = roomIds.length ? await service.from('student_documents').select('child_id', { count: 'exact', head: true }).eq('is_required', true).eq('status', 'missing').is('superseded_by', null) : { count: 0 };
  if (missingDocs) headsUp.push({ key: 'docs', title: `${missingDocs} student document${missingDocs > 1 ? 's' : ''} missing`, sub: 'Emergency medical authorization most common', badge: String(missingDocs), tone: 'amber' });

  const aging = await getAgingFamilyThreads();
  if (aging.length) headsUp.push({ key: 'aging', title: `A parent has waited ${aging[0]!.hours}h for a reply`, sub: `${aging[0]!.childName} · ${aging[0]!.snippet}`, badge: `${aging[0]!.hours}h`, tone: 'red', href: `/m/messages/${aging[0]!.id}` });

  // ── Staff today: late (scheduled, not clocked in) + floats/subs on call ──
  const isoDow = ((now.getDay() + 6) % 7) + 1;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const { data: rosterRows } = roomIds.length ? await service.from('classroom_staff').select('id, user_id, users(full_name)').in('classroom_id', roomIds) : { data: [] as { id: string; user_id: string | null; users: { full_name: string } | { full_name: string }[] | null }[] };
  const rosterSlotIds = (rosterRows ?? []).map((r) => r.id);
  const { data: shifts } = rosterSlotIds.length ? await service.from('staff_shift_slots').select('classroom_staff_id').eq('day_of_week', isoDow).in('classroom_staff_id', rosterSlotIds) : { data: [] as { classroom_staff_id: string }[] };
  const scheduled = new Set((shifts ?? []).map((s) => s.classroom_staff_id));
  const { data: open } = await service.from('time_entries').select('user_id').eq('center_id', centerId).is('clocked_out_at', null).gte('clocked_in_at', dayStart.toISOString());
  const present = new Set((open ?? []).map((e) => e.user_id));
  const staffToday: StaffTodayRow[] = [];
  const seen = new Set<string>();
  for (const r of rosterRows ?? []) {
    if (!r.user_id || !scheduled.has(r.id) || present.has(r.user_id) || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    staffToday.push({ key: `late-${r.user_id}`, name: u?.full_name ?? 'Staff', sub: 'Scheduled today · not clocked in', badge: 'Late', tone: 'amber' });
    if (staffToday.length >= 3) break;
  }
  const { data: subs } = await service.from('center_memberships').select('user_id, users(full_name)').eq('center_id', centerId).is('left_at', null).eq('role', 'substitute');
  for (const s of (subs ?? []).slice(0, 2)) {
    const u = Array.isArray(s.users) ? s.users[0] : s.users;
    staffToday.push({ key: `sub-${s.user_id}`, name: u?.full_name ?? 'Substitute', sub: 'Float · on call', badge: 'Available', tone: 'gray' });
  }

  const childrenEnrolled = (await service.from('children').select('id', { count: 'exact', head: true }).eq('center_id', centerId).eq('status', 'enrolled').is('deleted_at', null)).count ?? 0;

  return {
    centerName,
    roleLabel: ROLE_LABEL[role] ?? role,
    licensed: center?.licensed_capacity ?? 0,
    alert,
    moreOut: Math.max(0, outRooms.length - 1),
    stats: {
      staffOnFloor: evals.reduce((a, ev) => a + (ev.input?.staff.length ?? 0), 0),
      staffScheduled: ids.length,
      children: evals.reduce((a, ev) => a + (ev.input?.children.length ?? 0), 0),
      childrenEnrolled,
      // Only count rooms we could actually evaluate — a room whose data failed
      // to load must not be counted as compliant (fail safe, not open).
      compliant: evals.filter((ev) => ev.e && ev.e.status !== 'out').length,
      roomsTotal: evals.length,
    },
    approvals: approvalsAll.length,
    approvalsTop,
    rooms: adminRooms,
    headsUp,
    staffToday,
  };
}

// ── Float assignment (docs/sessions/04-ADMIN-MOBILE.md §5) ───────────────────
export type FloatCandidate = { userId: string; name: string; roleLabel: string; pill: string; tone: 'ok' | 'warn' | 'bad'; blocked: boolean; currentRoom: string | null };

export async function getFloatCandidates(classroomId: string): Promise<FloatCandidate[]> {
  const ctx = await requireAdmin();
  if (!ctx) return [];
  const { service, centerId } = ctx;
  const clock = getClock();
  const nowISO = clock.now().toISOString();

  const roomInput = await loadRoomInput(classroomId, clock, service);
  if (!roomInput) return [];
  const hasUnderTwo = evaluate(roomInput).rule.hasUnderTwo;
  const present = new Set(roomInput.staff.map((s) => s.id));

  const { data: members } = await service
    .from('center_memberships')
    .select('user_id, role, lead_qualified, infant_toddler_trained, users(full_name)')
    .eq('center_id', centerId)
    .is('left_at', null);

  // Who is where, now.
  const { data: assigns } = await service
    .from('staff_assignments')
    .select('user_id, classroom_id, classrooms(name)')
    .eq('center_id', centerId)
    .lte('starts_at', nowISO)
    .gt('ends_at', nowISO);
  const roomByUser = new Map<string, { id: string; name: string }>();
  for (const a of assigns ?? []) {
    const room = Array.isArray(a.classrooms) ? a.classrooms[0] : a.classrooms;
    roomByUser.set(a.user_id, { id: a.classroom_id, name: (room as { name: string } | null)?.name ?? 'a room' });
  }
  const inputCache = new Map<string, RoomInput | null>();
  const getInput = async (id: string) => {
    if (!inputCache.has(id)) inputCache.set(id, await loadRoomInput(id, clock, service));
    return inputCache.get(id) ?? null;
  };

  const out: FloatCandidate[] = [];
  for (const m of members ?? []) {
    if (present.has(m.user_id)) continue;
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    const cand: Staff = { id: m.user_id, leadQualified: m.lead_qualified, infantToddlerTrained: m.infant_toddler_trained };
    const sim = evaluate({ ...roomInput, staff: [...roomInput.staff, cand] });
    const cur = roomByUser.get(m.user_id) ?? null;

    let blocked = false;
    let pill: string;
    let tone: FloatCandidate['tone'];
    // Pulling them from a room that would then fall out of ratio blocks the move.
    if (cur && cur.id !== classroomId) {
      const src = await getInput(cur.id);
      if (src && !evaluate({ ...src, staff: src.staff.filter((s) => s.id !== m.user_id) }).ok) {
        blocked = true;
        pill = `Breaks ${cur.name}`;
        tone = 'bad';
      } else {
        pill = sim.ok ? 'Fixes it' : `Still ${Math.max(1, sim.requiredNow - (roomInput.staff.length + 1))} short`;
        tone = sim.ok ? 'ok' : 'warn';
      }
    } else {
      pill = sim.ok ? 'Fixes it' : `Still ${Math.max(1, sim.requiredNow - (roomInput.staff.length + 1))} short`;
      tone = sim.ok ? 'ok' : 'warn';
    }

    out.push({
      userId: m.user_id,
      name: u?.full_name ?? 'Staff',
      roleLabel: isLeadFor(cand, hasUnderTwo) ? 'Lead-qualified' : 'Aide',
      pill,
      tone,
      blocked,
      currentRoom: cur && cur.id !== classroomId ? cur.name : null,
    });
  }
  // Fixers first, then still-short, blocked last.
  const order = { ok: 0, warn: 1, bad: 2 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 8);
}

export async function assignFloat(classroomId: string, userId: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!ctx) throw new Error('Forbidden');
  const { service, centerId } = ctx;
  const now = getClock().now();
  const end = new Date(now);
  end.setHours(23, 59, 0, 0);
  await service.from('staff_assignments').insert({ center_id: centerId, classroom_id: classroomId, user_id: userId, starts_at: now.toISOString(), ends_at: end.toISOString(), source: 'float', assigned_by: ctx.userId });
  revalidatePath('/m/admin');
  revalidatePath('/m/admin/rooms');
  revalidatePath(`/m/classroom/${classroomId}`);
}

export async function applyAgeMixFix(classroomId: string): Promise<{ moved: string[]; to: string } | null> {
  const ctx = await requireAdmin();
  if (!ctx) throw new Error('Forbidden');
  const { service, centerId } = ctx;
  const clock = getClock();
  const { data: classrooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null);
  const rooms = classrooms ?? [];
  const inputs = await Promise.all(rooms.map((r) => loadRoomInput(r.id, clock, service)));
  const inputById: Record<string, RoomInput> = {};
  rooms.forEach((r, i) => { if (inputs[i]) inputById[r.id] = inputs[i]!; });
  const source = inputById[classroomId];
  if (!source) return null;
  const others = Object.fromEntries(Object.entries(inputById).filter(([id]) => id !== classroomId));
  const fix = suggestAgeMixFix(source, others);
  if (!fix) return null;
  await service.from('children').update({ classroom_id: fix.to }).in('id', fix.move);
  const { data: movers } = await service.from('children').select('first_name, last_name').in('id', fix.move);
  const toName = rooms.find((r) => r.id === fix.to)?.name ?? 'another room';
  revalidatePath('/m/admin');
  revalidatePath('/m/admin/rooms');
  return { moved: (movers ?? []).map((m) => childDisplayName(m)), to: toName };
}

// ── People (docs/sessions/04-ADMIN-MOBILE.md §7) ─────────────────────────────
export type StaffPerson = { userId: string; name: string; roleLabel: string; score: number; lead: boolean };
export type StudentPerson = { id: string; name: string; room: string; ageLabel: string; allergy: boolean };

const ROLE_LABEL: Record<string, string> = { director: 'Director', admin: 'Admin', lead_teacher: 'Lead Teacher', assistant_teacher: 'Assistant', aide: 'Aide', substitute: 'Float' };

export async function getPeople(): Promise<{ staff: StaffPerson[]; students: StudentPerson[] }> {
  const ctx = await requireAdmin();
  if (!ctx) return { staff: [], students: [] };
  const { service, centerId } = ctx;

  const { data: members } = await service
    .from('center_memberships')
    .select('user_id, role, lead_qualified, users(full_name)')
    .eq('center_id', centerId)
    .is('left_at', null);
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: scores } = userIds.length
    ? await service.from('teacher_scores').select('user_id, teacher_visible_score, center_score').eq('center_id', centerId).in('user_id', userIds)
    : { data: [] as { user_id: string; teacher_visible_score: number | null; center_score: number }[] };
  const scoreByUser = new Map((scores ?? []).map((s) => [s.user_id, Number(s.teacher_visible_score ?? s.center_score ?? 0)]));
  const staff: StaffPerson[] = (members ?? [])
    .map((m) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return { userId: m.user_id, name: u?.full_name ?? 'Staff', roleLabel: ROLE_LABEL[m.role] ?? m.role, score: scoreByUser.get(m.user_id) ?? 0, lead: m.lead_qualified };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: kids } = await service
    .from('children')
    .select('id, first_name, last_name, birthdate, classroom_id, classrooms(name)')
    .eq('center_id', centerId)
    .eq('status', 'enrolled')
    .is('deleted_at', null)
    .order('first_name');
  const kidIds = (kids ?? []).map((k) => k.id);
  const { data: sev } = kidIds.length
    ? await service.from('student_health').select('child_id').eq('severity', 'severe').in('child_id', kidIds)
    : { data: [] as { child_id: string }[] };
  const allergySet = new Set((sev ?? []).map((h) => h.child_id));
  const at = getClock().now();
  const students: StudentPerson[] = (kids ?? []).map((k) => {
    const room = Array.isArray(k.classrooms) ? k.classrooms[0] : k.classrooms;
    let months = (at.getFullYear() - new Date(k.birthdate).getFullYear()) * 12 + (at.getMonth() - new Date(k.birthdate).getMonth());
    if (months < 0) months = 0;
    return {
      id: k.id,
      name: childDisplayName(k),
      room: (room as { name: string } | null)?.name ?? 'Unassigned',
      ageLabel: months < 24 ? `${months} mo` : `${Math.floor(months / 12)}y`,
      allergy: allergySet.has(k.id),
    };
  });

  return { staff, students };
}
