'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { activeClassroomFor } from '@/lib/staffing/room-state';
import { getAgingFamilyThreads } from '@/app/(mobile)/m/messages/actions';
import { isAdmin, computeCredentialStatus, childDisplayName, type CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

export type Priority = {
  key: string;
  urgency: 'red' | 'amber' | 'done';
  title: string;
  sub: string;
  href?: string;
  taskId?: string; // completable assigned task
  faces?: { id: string; name: string; classroomId: string }[];
};
export type ShiftBlock = { room: string | null; roomId: string | null; from: string; to: string; role: string; now: boolean };
export type Announcement = { id: string; author: string; body: string; kind: string; at: string };
export type Spotlight = { category: string; name: string };
export type TodayData = {
  greeting: string;
  firstName: string;
  role: CenterRole;
  isFloat: boolean;
  isAdmin: boolean;
  centerName: string;
  dateLabel: string;
  timeLabel: string;
  announcements: Announcement[];
  priorities: Priority[];
  moreCount: number;
  shift: { clockIn: string | null; blocks: ShiftBlock[] };
  spotlights: Spotlight[];
  float: { here: ShiftBlock | null; onCall: boolean } | null;
};

function localDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

export async function getToday(): Promise<TodayData | null> {
  const active = getActiveContextFromCookies();
  if (!active) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const role = active.role;
  const isFloat = role === 'substitute';
  const admin = isAdmin(role);
  const clock = getClock();
  const at = clock.now();
  const nowISO = at.toISOString();
  const today = localDate(at);

  const { data: me } = await service.from('users').select('full_name').eq('id', user.id).maybeSingle();
  const firstName = (me?.full_name ?? 'there').split(' ')[0]!;
  const h = at.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  // Announcements (latest 2).
  const { data: anns } = await service
    .from('announcements')
    .select('id, body, kind, created_at, users(full_name)')
    .eq('center_id', active.centerId)
    .order('created_at', { ascending: false })
    .limit(2);
  const announcements: Announcement[] = (anns ?? []).map((a) => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    return { id: a.id, author: u?.full_name ?? 'Management', body: a.body, kind: a.kind, at: a.created_at ?? new Date().toISOString() };
  });

  // Today's assignments → shift blocks.
  const { data: assigns } = await service
    .from('staff_assignments')
    .select('classroom_id, starts_at, ends_at, source, classrooms(name)')
    .eq('user_id', user.id)
    .gte('starts_at', `${today}T00:00:00`)
    .order('starts_at');
  const blocks: ShiftBlock[] = (assigns ?? []).map((a) => {
    const room = Array.isArray(a.classrooms) ? a.classrooms[0] : a.classrooms;
    return {
      room: (room as { name: string } | null)?.name ?? null,
      roomId: a.classroom_id,
      from: fmtTime(a.starts_at),
      to: fmtTime(a.ends_at),
      role: a.source === 'cover' ? 'Covering' : 'On the floor',
      now: a.starts_at <= nowISO && a.ends_at > nowISO,
    };
  });
  const { data: entry } = await service
    .from('time_entries')
    .select('clocked_in_at')
    .eq('user_id', user.id)
    .gte('clocked_in_at', `${today}T00:00:00`)
    .order('clocked_in_at')
    .limit(1)
    .maybeSingle();
  const clockIn = entry?.clocked_in_at ? fmtTime(entry.clocked_in_at) : null;

  // ── Priorities ──
  const priorities: Priority[] = [];
  const activeRoom = (await activeClassroomFor(user.id, clock)) ?? blocks.find((b) => b.now)?.roomId ?? null;

  if (activeRoom && !isFloat) {
    const { data: present } = await service
      .from('child_attendance')
      .select('child_id, children(id, first_name, last_name, classroom_id)')
      .eq('classroom_id', activeRoom)
      .eq('attendance_date', today)
      .not('signed_in_at', 'is', null)
      .is('signed_out_at', null);
    const { data: upd } = await service.from('child_updates').select('child_update_children(child_id)').eq('classroom_id', activeRoom).gte('created_at', `${today}T00:00:00`);
    const updated = new Set<string>();
    for (const u of upd ?? []) for (const t of (u.child_update_children ?? []) as { child_id: string }[]) updated.add(t.child_id);
    const faces = (present ?? [])
      .map((p) => (Array.isArray(p.children) ? p.children[0] : p.children))
      .filter((c): c is { id: string; first_name: string; last_name: string; classroom_id: string } => !!c && !updated.has(c.id))
      .map((c) => ({ id: c.id, name: childDisplayName(c), classroomId: c.classroom_id }));
    if (faces.length) priorities.push({ key: 'updates', urgency: 'amber', title: `${faces.length} ${faces.length === 1 ? 'child needs' : 'children need'} an update`, sub: 'Before pickup · tap a face', faces, href: `/m/classroom/${activeRoom}` });
    else priorities.push({ key: 'updates-done', urgency: 'done', title: 'Every child has an update', sub: 'Parents will see these tonight' });
  }

  // Lesson plan due/returned (if lead of a room).
  const { data: leadRooms } = await service.from('classroom_staff').select('classroom_id').eq('user_id', user.id);
  const roomIds = [...new Set((leadRooms ?? []).map((r) => r.classroom_id))];
  if (roomIds.length && (role === 'lead_teacher' || admin)) {
    const monday = new Date(at);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const { data: plans } = await service.from('lesson_plans').select('classroom_id, status, classrooms(name)').in('classroom_id', roomIds).eq('week_of', localDate(monday));
    for (const p of plans ?? []) {
      if (p.status === 'draft' || p.status === 'returned') {
        const room = Array.isArray(p.classrooms) ? p.classrooms[0] : p.classrooms;
        priorities.push({ key: `plan-${p.classroom_id}`, urgency: p.status === 'returned' ? 'red' : 'amber', title: p.status === 'returned' ? 'Lesson plan returned' : "Next week's lesson plan", sub: p.status === 'returned' ? 'See the reviewer comment · resubmit' : `Due Monday 8 AM · ${(room as { name: string } | null)?.name ?? ''}`, href: `/m/classroom/${p.classroom_id}?tab=plan` });
      }
    }
  }

  // Own credential expiring ≤30 days.
  const { data: creds } = await service.from('credentials').select('credential_type, custom_type_name, expires_at').eq('user_id', user.id).is('deleted_at', null);
  for (const c of creds ?? []) {
    const st = computeCredentialStatus(c.expires_at);
    if (st === 'expiring_soon' || st === 'expired') {
      priorities.push({ key: `cred-${c.credential_type}`, urgency: st === 'expired' ? 'red' : 'amber', title: `${c.custom_type_name ?? c.credential_type.replace(/_/g, ' ')} ${st === 'expired' ? 'expired' : 'expires soon'}`, sub: 'Upload your renewal', href: '/m/me' });
      break; // one is enough for the list
    }
  }

  // Unanswered family messages (>24h) in this teacher's rooms — jump the queue.
  if (!isFloat) {
    const aging = await getAgingFamilyThreads();
    for (const a of aging) priorities.unshift({ key: `aging-${a.id}`, urgency: 'red', title: `${a.childName}'s family is waiting`, sub: `${a.hours}h unanswered · ${a.room}`, href: `/m/messages/${a.id}` });
  }

  // Assigned tasks.
  const { data: tasks } = await service.from('staff_tasks').select('id, title, detail, source').eq('assigned_to', user.id).is('completed_at', null).order('created_at');
  for (const t of tasks ?? []) priorities.push({ key: `task-${t.id}`, urgency: 'amber', title: t.title, sub: t.detail ?? (t.source === 'nudge' ? 'Nudge from your director' : 'Assigned by your director'), taskId: t.id });

  const visible = priorities.slice(0, 5);
  const moreCount = Math.max(0, priorities.length - visible.length);

  // Spotlights (this month).
  const monthStart = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-01`;
  const { data: spots } = await service.from('spotlights').select('category, users(full_name)').eq('center_id', active.centerId).eq('month', monthStart);
  const spotlights: Spotlight[] = (spots ?? []).map((s) => {
    const u = Array.isArray(s.users) ? s.users[0] : s.users;
    return { category: s.category, name: u?.full_name ?? 'A teammate' };
  });

  // Float state.
  let float: TodayData['float'] = null;
  if (isFloat) {
    const here = blocks.find((b) => b.now && b.roomId) ?? null;
    float = { here, onCall: !here };
  }

  return {
    greeting,
    firstName,
    role,
    isFloat,
    isAdmin: admin,
    centerName: active.centerName,
    dateLabel: at.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    timeLabel: fmtTime(nowISO),
    announcements,
    priorities: visible,
    moreCount,
    shift: { clockIn, blocks },
    spotlights,
    float,
  };
}

export async function completeTask(taskId: string): Promise<void> {
  const active = getActiveContextFromCookies();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !active) throw new Error('Forbidden');
  const service: Service = createServiceClient();
  await service.from('staff_tasks').update({ completed_at: getClock().now().toISOString() }).eq('id', taskId).eq('assigned_to', user.id);
  revalidatePath('/m/today');
}
