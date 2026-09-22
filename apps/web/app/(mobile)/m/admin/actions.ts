'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, nextAgeTransition, suggestAgeMixFix, mixText, BAND_LABEL, type RoomInput, type Evaluation } from '@kinderbase/core';
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
