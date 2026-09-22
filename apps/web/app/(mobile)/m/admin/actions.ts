'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, nextAgeTransition, suggestAgeMixFix, isLeadFor, mixText, BAND_LABEL, type RoomInput, type Evaluation, type Staff } from '@kinderbase/core';
import { isAdmin, computeCredentialStatus, childDisplayName } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function requireAdmin(): Promise<{ service: Service; centerId: string; centerName: string; userId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), centerId: active.centerId, centerName: active.centerName, userId: user.id };
}

export type AdminRoom = { id: string; name: string; status: 'ok' | 'at_minimum' | 'out'; ratio: string; required: number; present: number; mixText: string };
export type HeadsUp = { key: string; title: string; sub: string; badge: string; tone: 'red' | 'amber' | 'green' };
export type AdminHome = {
  centerName: string;
  alert:
    | { roomId: string; name: string; mixText: string; citation: string; required: number; present: number; missingLead: boolean; ageFix: { names: string[]; toRoomId: string; toRoom: string } | null }
    | null;
  moreOut: number;
  stats: { staffOnFloor: number; children: number; compliant: number; roomsTotal: number };
  approvals: number;
  rooms: AdminRoom[];
  headsUp: HeadsUp[];
};

const ratioText = (children: number, staff: number) => (staff ? `1:${Math.round(children / staff)}` : '—');

export async function getAdminHome(): Promise<AdminHome | null> {
  const ctx = await requireAdmin();
  if (!ctx) return null;
  const { service, centerId, centerName } = ctx;
  const clock = getClock();

  const { data: classrooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null).order('name');
  const rooms = classrooms ?? [];
  const inputs = await Promise.all(rooms.map((r) => loadRoomInput(r.id, clock, service)));
  const evals: { id: string; name: string; input: RoomInput | null; e: Evaluation | null }[] = rooms.map((r, i) => ({
    id: r.id,
    name: r.name,
    input: inputs[i] ?? null,
    e: inputs[i] ? evaluate(inputs[i]!) : null,
  }));
  const inputById: Record<string, RoomInput> = {};
  for (const ev of evals) if (ev.input) inputById[ev.id] = ev.input;

  const adminRooms: AdminRoom[] = evals.map((ev) => ({
    id: ev.id,
    name: ev.name,
    status: ev.e?.status ?? 'ok',
    ratio: ev.input ? ratioText(ev.input.children.length, ev.input.staff.length) : '—',
    required: ev.e?.requiredNow ?? 0,
    present: ev.input?.staff.length ?? 0,
    mixText: ev.e ? mixText(ev.e.mix) : 'no children',
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
    alert = {
      roomId: w.id,
      name: w.name,
      mixText: mixText(e.mix),
      citation: e.rule.citation,
      required: e.requiredNow,
      present: w.input?.staff.length ?? 0,
      missingLead: !e.checks.find((c) => c.key === 'lead')?.pass,
      ageFix,
    };
  }

  // Approvals: pending requests + submitted lesson plans.
  const { count: reqCount } = await service.from('staff_requests').select('id', { count: 'exact', head: true }).eq('center_id', centerId).eq('status', 'pending');
  const roomIds = rooms.map((r) => r.id);
  const { count: planCount } = roomIds.length
    ? await service.from('lesson_plans').select('id', { count: 'exact', head: true }).in('classroom_id', roomIds).eq('status', 'submitted')
    : { count: 0 };
  const approvals = (reqCount ?? 0) + (planCount ?? 0);

  // Heads-up: soonest age transition, expiring credentials, students missing docs.
  const headsUp: HeadsUp[] = [];
  let soonest: { name: string; room: string; inDays: number; to: string; needs: number } | null = null;
  for (const ev of evals) {
    if (!ev.input) continue;
    const t = nextAgeTransition(ev.input);
    if (t && (!soonest || t.inDays < soonest.inDays)) {
      const { data: child } = await service.from('children').select('first_name, last_name').eq('id', t.childId).maybeSingle();
      soonest = { name: child ? childDisplayName(child) : 'A child', room: ev.name, inDays: t.inDays, to: BAND_LABEL[t.to], needs: t.after.minStaff };
    }
  }
  if (soonest) headsUp.push({ key: 'age', title: `${soonest.name.split(' ')[0]} becomes a ${soonest.to} in ${soonest.inDays} days`, sub: `${soonest.room} will need ${soonest.needs} staff`, badge: `${soonest.inDays}d`, tone: 'amber' });

  const { data: staffIds } = await service.from('center_memberships').select('user_id').eq('center_id', centerId).is('left_at', null);
  const ids = (staffIds ?? []).map((s) => s.user_id);
  if (ids.length) {
    const { data: creds } = await service.from('credentials').select('expires_at').in('user_id', ids).is('deleted_at', null);
    const exp = (creds ?? []).filter((c) => ['expiring_soon', 'expired'].includes(computeCredentialStatus(c.expires_at))).length;
    if (exp) headsUp.push({ key: 'cred', title: `${exp} credential${exp > 1 ? 's' : ''} expiring this month`, sub: 'Staff renewals due', badge: String(exp), tone: 'red' });
  }
  const { count: missingDocs } = roomIds.length
    ? await service.from('student_documents').select('child_id', { count: 'exact', head: true }).eq('is_required', true).eq('status', 'missing').is('superseded_by', null)
    : { count: 0 };
  if (missingDocs) headsUp.push({ key: 'docs', title: `${missingDocs} required document${missingDocs > 1 ? 's' : ''} missing`, sub: 'Across enrolled students', badge: String(missingDocs), tone: 'amber' });

  return {
    centerName,
    alert,
    moreOut: Math.max(0, outRooms.length - 1),
    stats: {
      staffOnFloor: evals.reduce((a, ev) => a + (ev.input?.staff.length ?? 0), 0),
      children: evals.reduce((a, ev) => a + (ev.input?.children.length ?? 0), 0),
      compliant: evals.filter((ev) => ev.e?.status !== 'out').length,
      roomsTotal: evals.length,
    },
    approvals,
    rooms: adminRooms,
    headsUp,
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
