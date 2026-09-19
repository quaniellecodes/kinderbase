'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { computeRatio, type RatioRule, type RatioStatus } from '@kinderbase/core';
import {
  isAdmin,
  childDisplayName,
  ageInMonths,
  nextComarBoundary,
  daysUntil,
  type AgeGroup,
  type CenterRole,
  type UpdateType,
} from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

// ── date helpers (server-local "today") ────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStartISO(): string {
  return `${todayISO()}T00:00:00`;
}
function currentDow(): number {
  const js = new Date().getDay(); // 0=Sun..6=Sat
  return js === 0 ? 7 : js; // 1=Mon..7=Sun
}

function ratioOverrideFrom(row: { ratio_children_per_staff: number | null; ratio_max_group: number | null }): RatioRule | undefined {
  return row.ratio_children_per_staff != null && row.ratio_max_group != null
    ? { childrenPerStaff: row.ratio_children_per_staff, maxGroupSize: row.ratio_max_group }
    : undefined;
}

function currentRatioLabel(staff: number, children: number): string {
  if (children === 0) return '—';
  if (staff === 0) return `0:${children}`;
  return `1:${Math.round(children / staff)}`;
}

// ── auth ───────────────────────────────────────────────────────────────────
async function memberContext(): Promise<{ userId: string } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { userId: user.id } : null;
}

async function requireCenterMember(centerId: string): Promise<{ service: Service; userId: string; role: CenterRole } | null> {
  const ctx = await memberContext();
  if (!ctx) return null;
  const service = createServiceClient();
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', centerId)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null;
  return { service, userId: ctx.userId, role: m.role as CenterRole };
}

async function requireClassroomMember(classroomId: string) {
  const service = createServiceClient();
  const { data: c } = await service.from('classrooms').select('center_id').eq('id', classroomId).single();
  if (!c) return null;
  const authed = await requireCenterMember(c.center_id);
  if (!authed) return null;
  return { ...authed, centerId: c.center_id };
}

// ── shared shapes ──────────────────────────────────────────────────────────
export type FeedUpdate = {
  id: string;
  type: UpdateType;
  body: string;
  createdAt: string;
  authorName: string;
  children: { id: string; name: string }[];
};

export type DashboardRoom = {
  id: string;
  name: string;
  teachers: string[];
  staffPresent: number;
  childrenPresent: number;
  currentRatio: string;
  requiredRatio: string;
  status: RatioStatus;
};

export type DashboardData = {
  staffPresent: number;
  staffScheduled: number;
  childrenSignedIn: number;
  childrenEnrolled: number;
  roomsInRatio: number;
  roomsTotal: number;
  rooms: DashboardRoom[];
};

// ── dashboard ──────────────────────────────────────────────────────────────
export async function getCenterDashboard(centerId: string): Promise<DashboardData | null> {
  const authed = await requireCenterMember(centerId);
  if (!authed) return null;
  const { service } = authed;
  const today = todayISO();

  const { data: center } = await service.from('centers').select('state').eq('id', centerId).single();
  const state = center?.state ?? 'MD';

  const { data: classrooms } = await service
    .from('classrooms')
    .select('id, name, age_group, ratio_children_per_staff, ratio_max_group')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');
  const rooms = classrooms ?? [];
  const roomIds = rooms.map((r) => r.id);

  // Roster (per room) with member names.
  const { data: roster } = await service
    .from('classroom_staff')
    .select('id, classroom_id, user_id, staff_name, sort_order, users(full_name)')
    .in('classroom_id', roomIds.length ? roomIds : ['00000000-0000-0000-0000-000000000000'])
    .order('sort_order');

  // Present staff = open time entries today (center-wide).
  const { data: openEntries } = await service
    .from('time_entries')
    .select('user_id')
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .gte('clocked_in_at', todayStartISO());
  const presentUsers = new Set((openEntries ?? []).map((e) => e.user_id));

  // Scheduled staff = roster members with a shift slot today.
  const rosterIds = (roster ?? []).map((r) => r.id);
  const { data: shiftsToday } = rosterIds.length
    ? await service
        .from('staff_shift_slots')
        .select('classroom_staff_id')
        .eq('day_of_week', currentDow())
        .in('classroom_staff_id', rosterIds)
    : { data: [] as { classroom_staff_id: string }[] };
  const rosterWithShift = new Set((shiftsToday ?? []).map((s) => s.classroom_staff_id));

  // Today's attendance (present) per room.
  const { data: attendance } = roomIds.length
    ? await service
        .from('child_attendance')
        .select('classroom_id')
        .eq('attendance_date', today)
        .not('signed_in_at', 'is', null)
        .is('signed_out_at', null)
        .in('classroom_id', roomIds)
    : { data: [] as { classroom_id: string }[] };
  const presentByRoom = new Map<string, number>();
  for (const a of attendance ?? []) presentByRoom.set(a.classroom_id, (presentByRoom.get(a.classroom_id) ?? 0) + 1);

  const { count: childrenEnrolled } = await service
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('center_id', centerId)
    .eq('status', 'enrolled')
    .is('deleted_at', null);

  // Aggregate present + scheduled staff (distinct users, center-wide, from roster).
  const scheduledUsers = new Set<string>();
  const presentRosterUsers = new Set<string>();
  for (const r of roster ?? []) {
    if (!r.user_id) continue;
    if (rosterWithShift.has(r.id)) scheduledUsers.add(r.user_id);
    if (presentUsers.has(r.user_id)) presentRosterUsers.add(r.user_id);
  }

  const dashRooms: DashboardRoom[] = rooms.map((room) => {
    const roomRoster = (roster ?? []).filter((r) => r.classroom_id === room.id);
    const teachers = roomRoster.map((r) => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      return u?.full_name ?? r.staff_name ?? 'Staff';
    });
    const staffPresent = roomRoster.filter((r) => r.user_id && presentUsers.has(r.user_id)).length;
    const childrenPresent = presentByRoom.get(room.id) ?? 0;
    const override = ratioOverrideFrom(room);
    const result = computeRatio(room.age_group as AgeGroup, childrenPresent, staffPresent, state, override);
    return {
      id: room.id,
      name: room.name,
      teachers,
      staffPresent,
      childrenPresent,
      currentRatio: currentRatioLabel(staffPresent, childrenPresent),
      requiredRatio: `1:${result.childrenPerStaff}`,
      status: result.status,
    };
  });

  return {
    staffPresent: presentRosterUsers.size,
    staffScheduled: scheduledUsers.size,
    childrenSignedIn: attendance?.length ?? 0,
    childrenEnrolled: childrenEnrolled ?? 0,
    roomsInRatio: dashRooms.filter((r) => r.status !== 'violation').length,
    roomsTotal: dashRooms.length,
    rooms: dashRooms,
  };
}

// ── update mapping ─────────────────────────────────────────────────────────
type RawUpdate = {
  id: string;
  update_type: string;
  body: string;
  created_at: string;
  users: { full_name: string } | { full_name: string }[] | null;
  child_update_children: { children: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null }[] | null;
};

function mapUpdate(row: RawUpdate): FeedUpdate {
  const author = Array.isArray(row.users) ? row.users[0] : row.users;
  const children = (row.child_update_children ?? [])
    .map((t) => (Array.isArray(t.children) ? t.children[0] : t.children))
    .filter((c): c is { id: string; first_name: string; last_name: string } => !!c)
    .map((c) => ({ id: c.id, name: childDisplayName(c) }));
  return {
    id: row.id,
    type: row.update_type as UpdateType,
    body: row.body,
    createdAt: row.created_at,
    authorName: author?.full_name ?? 'Staff',
    children,
  };
}

const UPDATE_SELECT =
  'id, update_type, body, created_at, users(full_name), child_update_children(children(id, first_name, last_name))';

// ── classroom overview ─────────────────────────────────────────────────────
export type AccountabilityRow = { userId: string; name: string; role: CenterRole; posts7d: number; lastPostedAt: string | null };
export type OverviewChild = { id: string; name: string; ageMonths: number; updatesToday: number; present: boolean; signedInAt: string | null };
export type BirthdayAlert = { childName: string; date: string; days: number; fromGroup: AgeGroup; toGroup: AgeGroup };
export type AssignedStaff = { name: string; present: boolean; clockedInAt: string | null };

export type ClassroomOverview = {
  glance: { childrenPresent: number; childrenEnrolled: number; staffPresent: number; staffAssigned: number; currentRatio: string; requiredRatio: string; status: RatioStatus };
  accountability: AccountabilityRow[];
  recentUpdates: FeedUpdate[];
  children: OverviewChild[];
  birthdayAlerts: BirthdayAlert[];
  assignedStaff: AssignedStaff[];
};

export async function getClassroomOverview(classroomId: string): Promise<ClassroomOverview | null> {
  const authed = await requireClassroomMember(classroomId);
  if (!authed) return null;
  const { service, centerId } = authed;
  const today = todayISO();

  const { data: classroom } = await service
    .from('classrooms')
    .select('age_group, ratio_children_per_staff, ratio_max_group, centers(state)')
    .eq('id', classroomId)
    .single();
  if (!classroom) return null;
  const center = Array.isArray(classroom.centers) ? classroom.centers[0] : classroom.centers;
  const state = (center as { state: string } | null)?.state ?? 'MD';
  const ageGroup = classroom.age_group as AgeGroup;
  const override = ratioOverrideFrom(classroom);

  // Roster (staff members on this room) + their center roles.
  const { data: roster } = await service
    .from('classroom_staff')
    .select('user_id, staff_name, sort_order, users(full_name)')
    .eq('classroom_id', classroomId)
    .not('user_id', 'is', null)
    .order('sort_order');
  const rosterUserIds = (roster ?? []).map((r) => r.user_id).filter((x): x is string => !!x);

  const { data: memberships } = rosterUserIds.length
    ? await service.from('center_memberships').select('user_id, role').eq('center_id', centerId).in('user_id', rosterUserIds)
    : { data: [] as { user_id: string; role: string }[] };
  const roleByUser = new Map((memberships ?? []).map((m) => [m.user_id, m.role as CenterRole]));

  // Present staff (open entries today) with clock-in time.
  const { data: openEntries } = rosterUserIds.length
    ? await service
        .from('time_entries')
        .select('user_id, clocked_in_at')
        .eq('center_id', centerId)
        .is('clocked_out_at', null)
        .gte('clocked_in_at', todayStartISO())
        .in('user_id', rosterUserIds)
    : { data: [] as { user_id: string; clocked_in_at: string }[] };
  const clockInByUser = new Map((openEntries ?? []).map((e) => [e.user_id, e.clocked_in_at]));

  // Children enrolled in the room.
  const { data: kids } = await service
    .from('children')
    .select('id, first_name, last_name, birthdate')
    .eq('classroom_id', classroomId)
    .eq('status', 'enrolled')
    .is('deleted_at', null)
    .order('first_name');

  // Today's attendance.
  const { data: attendance } = await service
    .from('child_attendance')
    .select('child_id, signed_in_at, signed_out_at')
    .eq('classroom_id', classroomId)
    .eq('attendance_date', today);
  const attByChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));

  // Updates: last 30 days for accountability, plus today's tags for per-child counts.
  const { data: recent } = await service
    .from('child_updates')
    .select(`${UPDATE_SELECT}, author_id`)
    .eq('classroom_id', classroomId)
    .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order('created_at', { ascending: false });

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const postsByAuthor = new Map<string, { posts7d: number; last: string | null }>();
  for (const u of recent ?? []) {
    const aid = (u as { author_id: string | null }).author_id;
    if (!aid) continue;
    const entry = postsByAuthor.get(aid) ?? { posts7d: 0, last: null };
    if (new Date(u.created_at).getTime() >= sevenDaysAgo) entry.posts7d++;
    if (!entry.last || u.created_at > entry.last) entry.last = u.created_at;
    postsByAuthor.set(aid, entry);
  }

  const accountability: AccountabilityRow[] = (roster ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const stat = r.user_id ? postsByAuthor.get(r.user_id) : undefined;
    return {
      userId: r.user_id as string,
      name: u?.full_name ?? r.staff_name ?? 'Staff',
      role: (r.user_id && roleByUser.get(r.user_id)) || 'assistant_teacher',
      posts7d: stat?.posts7d ?? 0,
      lastPostedAt: stat?.last ?? null,
    };
  });

  // Today's updates → per-child counts.
  const updatesTodayByChild = new Map<string, number>();
  for (const u of recent ?? []) {
    if (u.created_at.slice(0, 10) !== today) continue;
    for (const t of u.child_update_children ?? []) {
      const c = Array.isArray(t.children) ? t.children[0] : t.children;
      if (c) updatesTodayByChild.set(c.id, (updatesTodayByChild.get(c.id) ?? 0) + 1);
    }
  }

  const children: OverviewChild[] = (kids ?? []).map((c) => {
    const att = attByChild.get(c.id);
    return {
      id: c.id,
      name: childDisplayName(c),
      ageMonths: ageInMonths(c.birthdate),
      updatesToday: updatesTodayByChild.get(c.id) ?? 0,
      present: !!att?.signed_in_at && !att?.signed_out_at,
      signedInAt: att?.signed_in_at ?? null,
    };
  });

  const birthdayAlerts: BirthdayAlert[] = [];
  for (const c of kids ?? []) {
    const b = nextComarBoundary(c.birthdate);
    if (!b) continue;
    const days = daysUntil(b.date);
    if (days >= 0 && days <= 14) {
      birthdayAlerts.push({ childName: childDisplayName(c), date: b.date, days, fromGroup: b.fromGroup, toGroup: b.toGroup });
    }
  }

  const assignedStaff: AssignedStaff[] = (roster ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return {
      name: u?.full_name ?? r.staff_name ?? 'Staff',
      present: !!(r.user_id && clockInByUser.has(r.user_id)),
      clockedInAt: (r.user_id && clockInByUser.get(r.user_id)) || null,
    };
  });

  const childrenPresent = children.filter((c) => c.present).length;
  const staffPresent = assignedStaff.filter((s) => s.present).length;
  const result = computeRatio(ageGroup, childrenPresent, staffPresent, state, override);

  return {
    glance: {
      childrenPresent,
      childrenEnrolled: kids?.length ?? 0,
      staffPresent,
      staffAssigned: assignedStaff.length,
      currentRatio: currentRatioLabel(staffPresent, childrenPresent),
      requiredRatio: `1:${result.childrenPerStaff}`,
      status: result.status,
    },
    accountability,
    recentUpdates: (recent ?? []).slice(0, 3).map((u) => mapUpdate(u as RawUpdate)),
    children,
    birthdayAlerts,
    assignedStaff,
  };
}

// ── children tab ───────────────────────────────────────────────────────────
export type ChildCard = OverviewChild & { boundary: BirthdayAlert | null };

export async function getClassroomChildren(classroomId: string): Promise<ChildCard[]> {
  const authed = await requireClassroomMember(classroomId);
  if (!authed) return [];
  const { service } = authed;
  const today = todayISO();

  const { data: kids } = await service
    .from('children')
    .select('id, first_name, last_name, birthdate')
    .eq('classroom_id', classroomId)
    .eq('status', 'enrolled')
    .is('deleted_at', null)
    .order('first_name');

  const { data: attendance } = await service
    .from('child_attendance')
    .select('child_id, signed_in_at, signed_out_at')
    .eq('classroom_id', classroomId)
    .eq('attendance_date', today);
  const attByChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));

  const { data: todayUpdates } = await service
    .from('child_updates')
    .select('child_update_children(child_id)')
    .eq('classroom_id', classroomId)
    .gte('created_at', todayStartISO());
  const updatesByChild = new Map<string, number>();
  for (const u of todayUpdates ?? []) {
    for (const t of (u.child_update_children ?? []) as { child_id: string }[]) {
      updatesByChild.set(t.child_id, (updatesByChild.get(t.child_id) ?? 0) + 1);
    }
  }

  return (kids ?? []).map((c) => {
    const att = attByChild.get(c.id);
    const b = nextComarBoundary(c.birthdate);
    const days = b ? daysUntil(b.date) : -1;
    return {
      id: c.id,
      name: childDisplayName(c),
      ageMonths: ageInMonths(c.birthdate),
      updatesToday: updatesByChild.get(c.id) ?? 0,
      present: !!att?.signed_in_at && !att?.signed_out_at,
      signedInAt: att?.signed_in_at ?? null,
      boundary: b && days >= 0 && days <= 14 ? { childName: childDisplayName(c), date: b.date, days, fromGroup: b.fromGroup, toGroup: b.toGroup } : null,
    };
  });
}

// ── activity feed tab ──────────────────────────────────────────────────────
export async function getChildUpdates(classroomId: string, filter?: UpdateType): Promise<FeedUpdate[]> {
  const authed = await requireClassroomMember(classroomId);
  if (!authed) return [];
  const { service } = authed;

  let q = service
    .from('child_updates')
    .select(UPDATE_SELECT)
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter) q = q.eq('update_type', filter);
  const { data } = await q;
  return (data ?? []).map((u) => mapUpdate(u as RawUpdate));
}

// ── mutations ──────────────────────────────────────────────────────────────
export async function postChildUpdate(
  classroomId: string,
  input: { type: UpdateType; body: string; childIds: string[] }
) {
  const authed = await requireClassroomMember(classroomId);
  if (!authed) throw new Error('Forbidden');
  const { service, userId } = authed;
  if (!input.body.trim()) throw new Error('Update text required');

  const { data: update, error } = await service
    .from('child_updates')
    .insert({ classroom_id: classroomId, author_id: userId, update_type: input.type, body: input.body.trim() })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (input.childIds.length) {
    await service.from('child_update_children').insert(
      input.childIds.map((child_id) => ({ update_id: update.id, child_id }))
    );
  }
  revalidatePath(`/classrooms/${classroomId}`);
}

export async function signInChild(childId: string) {
  await setChildPresence(childId, true);
}
export async function signOutChild(childId: string) {
  await setChildPresence(childId, false);
}

async function setChildPresence(childId: string, signIn: boolean) {
  const ctx = await memberContext();
  if (!ctx) throw new Error('Unauthenticated');
  const service = createServiceClient();
  const { data: child } = await service
    .from('children')
    .select('center_id, classroom_id')
    .eq('id', childId)
    .single();
  if (!child?.classroom_id) throw new Error('Child not in a classroom');
  const authed = await requireCenterMember(child.center_id);
  if (!authed) throw new Error('Forbidden');

  const now = new Date().toISOString();
  if (signIn) {
    await service.from('child_attendance').upsert(
      { child_id: childId, classroom_id: child.classroom_id, attendance_date: todayISO(), signed_in_at: now, signed_out_at: null },
      { onConflict: 'child_id,attendance_date' }
    );
  } else {
    await service
      .from('child_attendance')
      .update({ signed_out_at: now })
      .eq('child_id', childId)
      .eq('attendance_date', todayISO());
  }
  revalidatePath(`/classrooms/${child.classroom_id}`);
  revalidatePath('/dashboard');
}

export async function nudgeTeacher(classroomId: string, teacherId: string, teacherName: string) {
  const authed = await requireClassroomMember(classroomId);
  if (!authed || !isAdmin(authed.role)) throw new Error('Forbidden');
  const { service, centerId, userId } = authed;
  await service.from('activity_log').insert({
    center_id: centerId,
    actor_id: userId,
    event_type: 'staff.nudged',
    payload: { teacher_id: teacherId, teacher_name: teacherName, classroom_id: classroomId },
  });
}

export async function setRatioOverride(
  classroomId: string,
  override: { childrenPerStaff: number; maxGroup: number } | null
) {
  const authed = await requireClassroomMember(classroomId);
  if (!authed || !isAdmin(authed.role)) throw new Error('Forbidden');
  const { service } = authed;

  if (override) {
    if (override.childrenPerStaff <= 0 || override.maxGroup <= 0) throw new Error('Ratio values must be positive');
    await service
      .from('classrooms')
      .update({ ratio_children_per_staff: override.childrenPerStaff, ratio_max_group: override.maxGroup })
      .eq('id', classroomId);
  } else {
    await service
      .from('classrooms')
      .update({ ratio_children_per_staff: null, ratio_max_group: null })
      .eq('id', classroomId);
  }
  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath('/dashboard');
}
