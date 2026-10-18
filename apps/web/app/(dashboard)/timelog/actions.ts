'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { staffState, hoursWorked, breakHours, childState, type StaffState, type ChildState } from '@kinderbase/core';
import { isAdmin, childDisplayName, type CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

const ROLE_LABEL: Record<string, string> = { director: 'Director', admin: 'Admin', lead_teacher: 'Lead Teacher', assistant_teacher: 'Assistant', aide: 'Aide', substitute: 'Float' };

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** ISO weekday 1=Mon…7=Sun for a local-date string. */
function isoDow(dateISO: string): number {
  return ((new Date(`${dateISO}T00:00:00`).getDay() + 6) % 7) + 1;
}
/** 30-minute slot index (0–47) → that instant on `dateISO`, local time. */
function slotStart(dateISO: string, slot: number): Date {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setMinutes(slot * 30);
  return d;
}
/** Monday (local) of the week containing `d`. */
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

// ── Admin: today's log for all staff + all children (09 §5) ──────────────────

export type StaffLogRow = {
  userId: string;
  name: string;
  roleLabel: string;
  room: string;
  state: StaffState;
  label: string;
  punchIn: string | null;
  punchOut: string | null;
  onBreakSince: string | null;
  breakMinutes: number;
  workedHours: number;
  rosterMismatch: boolean;
};
export type ChildLogRow = {
  childId: string;
  name: string;
  room: string;
  state: ChildState;
  signedInAt: string | null;
  signedOutAt: string | null;
  signedInBy: string | null;
  signedOutBy: string | null;
};
export type TimeLog = {
  date: string;
  now: string;
  staff: StaffLogRow[];
  children: ChildLogRow[];
  staffSummary: { onFloor: number; onBreak: number; notIn: number; out: number };
  childSummary: { here: number; gone: number; absent: number };
};

async function requireAdminCtx(): Promise<{ service: Service; centerId: string; role: CenterRole; userId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), centerId: active.centerId, role: active.role, userId: user.id };
}

export async function getTimeLog({ date }: { date?: string } = {}): Promise<TimeLog> {
  const ctx = await requireAdminCtx();
  // A teacher must never receive another person's punch data — decided server-side.
  if (!ctx) throw new Error('Forbidden');
  const { service, centerId } = ctx;
  const clock = getClock();
  const now = clock.now();
  const dateISO = date ?? localDateISO(now);
  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  // Live "now" for elapsed timers only when the log is for today; otherwise noon.
  const ref = dateISO === localDateISO(now) ? now : new Date(`${dateISO}T12:00:00`);
  const refISO = ref.toISOString();
  const dow = isoDow(dateISO);

  const { data: rooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null).order('name');
  const roomIds = (rooms ?? []).map((r) => r.id);
  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]));

  // ── Staff ──
  const { data: members } = await service.from('center_memberships').select('user_id, role, users(full_name)').eq('center_id', centerId).is('left_at', null);
  const staffMembers = (members ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return { userId: m.user_id, name: u?.full_name ?? 'Staff', role: m.role };
  });
  const userIds = staffMembers.map((m) => m.userId);

  const { data: entries } = userIds.length
    ? await service.from('time_entries').select('user_id, clocked_in_at, clocked_out_at').eq('center_id', centerId).gte('clocked_in_at', dayStart.toISOString()).lt('clocked_in_at', dayEnd.toISOString())
    : { data: [] as { user_id: string; clocked_in_at: string; clocked_out_at: string | null }[] };
  const entriesByUser = new Map<string, { in: Date; out: Date | null }[]>();
  for (const e of entries ?? []) {
    const list = entriesByUser.get(e.user_id) ?? [];
    list.push({ in: new Date(e.clocked_in_at), out: e.clocked_out_at ? new Date(e.clocked_out_at) : null });
    entriesByUser.set(e.user_id, list);
  }

  const { data: breaks } = userIds.length
    ? await service.from('staff_breaks').select('user_id, started_at, ended_at').in('user_id', userIds).gte('started_at', dayStart.toISOString()).lt('started_at', dayEnd.toISOString())
    : { data: [] as { user_id: string; started_at: string; ended_at: string | null }[] };
  const breaksByUser = new Map<string, { start: Date; end: Date | null }[]>();
  for (const b of breaks ?? []) {
    const list = breaksByUser.get(b.user_id) ?? [];
    list.push({ start: new Date(b.started_at), end: b.ended_at ? new Date(b.ended_at) : null });
    breaksByUser.set(b.user_id, list);
  }

  // Who is assigned (counted toward ratio) at the reference instant, and where.
  const { data: assigns } = await service.from('staff_assignments').select('user_id, classroom_id').eq('center_id', centerId).lte('starts_at', refISO).gt('ends_at', refISO);
  const roomByUser = new Map<string, string>();
  for (const a of assigns ?? []) if (!roomByUser.has(a.user_id)) roomByUser.set(a.user_id, a.classroom_id);

  // Roster → home room + today's scheduled start (earliest slot).
  const { data: rosterRows } = roomIds.length ? await service.from('classroom_staff').select('id, user_id, classroom_id').in('classroom_id', roomIds) : { data: [] as { id: string; user_id: string | null; classroom_id: string }[] };
  const rosterRowIds = (rosterRows ?? []).map((r) => r.id);
  const userByRosterRow = new Map((rosterRows ?? []).filter((r) => r.user_id).map((r) => [r.id, r.user_id as string]));
  const homeRoomByUser = new Map<string, string>();
  for (const r of rosterRows ?? []) if (r.user_id && !homeRoomByUser.has(r.user_id)) homeRoomByUser.set(r.user_id, r.classroom_id);
  const { data: slots } = rosterRowIds.length ? await service.from('staff_shift_slots').select('classroom_staff_id, slot').eq('day_of_week', dow).in('classroom_staff_id', rosterRowIds) : { data: [] as { classroom_staff_id: string; slot: number }[] };
  const earliestSlotByUser = new Map<string, number>();
  for (const s of slots ?? []) {
    const uid = userByRosterRow.get(s.classroom_staff_id);
    if (!uid) continue;
    const cur = earliestSlotByUser.get(uid);
    if (cur === undefined || s.slot < cur) earliestSlotByUser.set(uid, s.slot);
  }

  const staff: StaffLogRow[] = staffMembers.map((m) => {
    const es = entriesByUser.get(m.userId) ?? [];
    const bs = breaksByUser.get(m.userId) ?? [];
    const punchIn = es.length ? new Date(Math.min(...es.map((e) => e.in.getTime()))) : undefined;
    const anyOpen = es.some((e) => !e.out);
    const punchOut = es.length && !anyOpen ? new Date(Math.max(...es.map((e) => e.out!.getTime()))) : undefined;
    const openBreak = bs.find((b) => !b.end);
    const scheduledSlot = earliestSlotByUser.get(m.userId);
    const scheduledStart = scheduledSlot !== undefined ? slotStart(dateISO, scheduledSlot) : undefined;
    const rostered = roomByUser.has(m.userId);

    const s = staffState({ punchIn, punchOut, breakStart: openBreak?.start, breakEnd: openBreak?.end ?? undefined, scheduledStart, rostered, now: ref });
    const worked = punchIn ? es.reduce((a, e) => a + hoursWorked(e.in, e.out, bs, ref), 0) : 0;
    const roomId = roomByUser.get(m.userId) ?? homeRoomByUser.get(m.userId);
    return {
      userId: m.userId,
      name: m.name,
      roleLabel: ROLE_LABEL[m.role] ?? m.role,
      room: roomId ? roomName.get(roomId) ?? '—' : '—',
      state: s.state,
      label: s.label,
      punchIn: punchIn?.toISOString() ?? null,
      punchOut: punchOut?.toISOString() ?? null,
      onBreakSince: openBreak?.start.toISOString() ?? null,
      breakMinutes: Math.round(breakHours(bs, ref) * 60),
      workedHours: worked,
      rosterMismatch: s.rosterMismatch,
    };
  });
  staff.sort((a, b) => a.name.localeCompare(b.name));

  // ── Children ──
  const { data: att } = roomIds.length
    ? await service.from('child_attendance').select('child_id, classroom_id, signed_in_at, signed_out_at, signed_in_by, signed_out_by, children(first_name, last_name)').eq('attendance_date', dateISO).in('classroom_id', roomIds)
    : { data: [] as { child_id: string; classroom_id: string; signed_in_at: string | null; signed_out_at: string | null; signed_in_by: string | null; signed_out_by: string | null; children: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }[] };

  // Resolve who signed children in/out (guardians — plain uuid, no FK, so query by id).
  const guardianIds = [...new Set((att ?? []).flatMap((a) => [a.signed_in_by, a.signed_out_by]).filter((x): x is string => !!x))];
  const { data: guardians } = guardianIds.length ? await service.from('guardians').select('id, full_name').in('id', guardianIds) : { data: [] as { id: string; full_name: string }[] };
  const guardianName = new Map((guardians ?? []).map((g) => [g.id, g.full_name]));

  const { data: enrolled } = await service.from('children').select('id, first_name, last_name, classroom_id').eq('center_id', centerId).eq('status', 'enrolled').eq('is_sample', false).is('deleted_at', null);
  const hasRow = new Set((att ?? []).map((a) => a.child_id));

  const children: ChildLogRow[] = [
    ...(att ?? []).map((a) => {
      const c = Array.isArray(a.children) ? a.children[0] : a.children;
      return {
        childId: a.child_id,
        name: c ? childDisplayName(c) : 'Child',
        room: roomName.get(a.classroom_id) ?? '—',
        state: childState({ signedIn: a.signed_in_at ? new Date(a.signed_in_at) : null, signedOut: a.signed_out_at ? new Date(a.signed_out_at) : null }),
        signedInAt: a.signed_in_at,
        signedOutAt: a.signed_out_at,
        signedInBy: a.signed_in_by ? guardianName.get(a.signed_in_by) ?? null : null,
        signedOutBy: a.signed_out_by ? guardianName.get(a.signed_out_by) ?? null : null,
      };
    }),
    ...(enrolled ?? []).filter((c) => !hasRow.has(c.id)).map((c) => ({
      childId: c.id,
      name: childDisplayName(c),
      room: c.classroom_id ? roomName.get(c.classroom_id) ?? '—' : '—',
      state: 'absent' as ChildState,
      signedInAt: null,
      signedOutAt: null,
      signedInBy: null,
      signedOutBy: null,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return {
    date: dateISO,
    now: ref.toISOString(),
    staff,
    children,
    staffSummary: {
      onFloor: staff.filter((s) => s.state === 'in').length,
      onBreak: staff.filter((s) => s.state === 'break').length,
      notIn: staff.filter((s) => s.state === 'late').length,
      out: staff.filter((s) => s.state === 'out').length,
    },
    childSummary: {
      here: children.filter((c) => c.state === 'here').length,
      gone: children.filter((c) => c.state === 'gone').length,
      absent: children.filter((c) => c.state === 'absent').length,
    },
  };
}

// ── Teacher: my own week (09 §5) ─────────────────────────────────────────────

export type MyDayRow = {
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  breakCount: number;
  breakMinutes: number;
  workedHours: number;
  scheduledHours: number;
  isToday: boolean;
  isOpen: boolean;
};
export type MyTimesheet = {
  weekOf: string;
  now: string;
  days: MyDayRow[];
  totals: { worked: number; onClock: number; breaks: number; scheduled: number };
};

export async function getMyTimesheet({ weekOf }: { weekOf?: string } = {}): Promise<MyTimesheet | null> {
  const active = getActiveContextFromCookies();
  if (!active) return null;
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const centerId = active.centerId;
  const clock = getClock();
  const now = clock.now();
  const todayISO = localDateISO(now);

  const monday = weekOf ? new Date(`${weekOf}T00:00:00`) : mondayOf(now);
  const weekStart = new Date(monday);
  const weekEnd = new Date(monday);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: entries } = await service.from('time_entries').select('clocked_in_at, clocked_out_at').eq('center_id', centerId).eq('user_id', user.id).gte('clocked_in_at', weekStart.toISOString()).lt('clocked_in_at', weekEnd.toISOString());
  const { data: breaks } = await service.from('staff_breaks').select('started_at, ended_at').eq('user_id', user.id).gte('started_at', weekStart.toISOString()).lt('started_at', weekEnd.toISOString());

  // Roster slots for this user, by weekday, for scheduled hours.
  const { data: rosterRows } = await service.from('classroom_staff').select('id, classrooms(center_id)').eq('user_id', user.id);
  const myRowIds = (rosterRows ?? []).filter((r) => {
    const c = Array.isArray(r.classrooms) ? r.classrooms[0] : r.classrooms;
    return (c as { center_id: string } | null)?.center_id === centerId;
  }).map((r) => r.id);
  const { data: slots } = myRowIds.length ? await service.from('staff_shift_slots').select('day_of_week, slot').in('classroom_staff_id', myRowIds) : { data: [] as { day_of_week: number; slot: number }[] };
  const slotCountByDow = new Map<number, number>();
  for (const s of slots ?? []) slotCountByDow.set(s.day_of_week, (slotCountByDow.get(s.day_of_week) ?? 0) + 1);

  const days: MyDayRow[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dISO = localDateISO(d);
    const dStart = new Date(`${dISO}T00:00:00`);
    const dEnd = new Date(dStart);
    dEnd.setDate(dEnd.getDate() + 1);
    const es = (entries ?? []).filter((e) => { const t = new Date(e.clocked_in_at); return t >= dStart && t < dEnd; }).map((e) => ({ in: new Date(e.clocked_in_at), out: e.clocked_out_at ? new Date(e.clocked_out_at) : null }));
    const bs = (breaks ?? []).filter((b) => { const t = new Date(b.started_at); return t >= dStart && t < dEnd; }).map((b) => ({ start: new Date(b.started_at), end: b.ended_at ? new Date(b.ended_at) : null }));
    const punchIn = es.length ? new Date(Math.min(...es.map((e) => e.in.getTime()))) : null;
    const anyOpen = es.some((e) => !e.out);
    const punchOut = es.length && !anyOpen ? new Date(Math.max(...es.map((e) => e.out!.getTime()))) : null;
    const worked = es.reduce((a, e) => a + hoursWorked(e.in, e.out, bs, now), 0);
    const dow = ((d.getDay() + 6) % 7) + 1;
    days.push({
      date: dISO,
      punchIn: punchIn?.toISOString() ?? null,
      punchOut: punchOut?.toISOString() ?? null,
      breakCount: bs.length,
      breakMinutes: Math.round(breakHours(bs, now) * 60),
      workedHours: worked,
      scheduledHours: (slotCountByDow.get(dow) ?? 0) * 0.5,
      isToday: dISO === todayISO,
      isOpen: anyOpen,
    });
  }

  const onClock = days.reduce((a, d) => {
    if (!d.punchIn) return a;
    const end = d.punchOut ? new Date(d.punchOut) : (d.isOpen ? now : new Date(d.punchIn));
    return a + Math.max(0, (end.getTime() - new Date(d.punchIn).getTime()) / 3_600_000);
  }, 0);

  return {
    weekOf: localDateISO(monday),
    now: now.toISOString(),
    days,
    totals: {
      worked: days.reduce((a, d) => a + d.workedHours, 0),
      onClock,
      breaks: days.reduce((a, d) => a + d.breakMinutes, 0) / 60,
      scheduled: days.reduce((a, d) => a + d.scheduledHours, 0),
    },
  };
}
