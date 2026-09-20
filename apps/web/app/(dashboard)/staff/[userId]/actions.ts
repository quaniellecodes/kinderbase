'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import {
  isAdmin,
  computeCredentialStatus,
  CREDENTIAL_TYPE_LABELS,
  type CenterRole,
  type CredentialType,
  type CredentialStatus,
  type NoteCategory,
  type AvailabilityStatus,
  type StaffProfileRow,
  type TeacherScoreRow,
  type StaffRequestType,
} from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

// ── date helpers ─────────────────────────────────────────────────────────────
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── auth ─────────────────────────────────────────────────────────────────────
type Viewer = { service: Service; viewerId: string; centerId: string; isSelf: boolean; admin: boolean; targetRole: CenterRole };

async function resolveViewer(targetUserId: string): Promise<Viewer | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ctx = getActiveContextFromCookies();
  if (!ctx) return null;

  const service = createServiceClient();
  const { data: targetM } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', ctx.centerId)
    .eq('user_id', targetUserId)
    .is('left_at', null)
    .maybeSingle();
  if (!targetM) return null;

  const isSelf = user.id === targetUserId;
  const admin = isAdmin(ctx.role);
  if (!isSelf && !admin) return null;

  return { service, viewerId: user.id, centerId: ctx.centerId, isSelf, admin, targetRole: targetM.role as CenterRole };
}

async function requireAdmin(targetUserId: string): Promise<Viewer> {
  const v = await resolveViewer(targetUserId);
  if (!v || !v.admin) throw new Error('Forbidden');
  return v;
}

// ── shared: attendance (rolling 90 days) ─────────────────────────────────────
export type AttendanceCell = { date: string; status: 'present' | 'absent' | 'leave' | 'off' | 'future' };
export type AttendanceData = { rate: number; present: number; unexcused: number; pto: number; weeks: AttendanceCell[][] };

async function computeAttendance(service: Service, userId: string, centerId: string): Promise<AttendanceData> {
  const since = daysAgo(90);
  const { data: entries } = await service
    .from('time_entries')
    .select('clocked_in_at')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .gte('clocked_in_at', since.toISOString());
  const presentDays = new Set((entries ?? []).map((e) => isoDay(new Date(e.clocked_in_at))));

  const { data: leave } = await service
    .from('staff_leave_days')
    .select('day, kind')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .gte('day', isoDay(since));
  const leaveByDay = new Map((leave ?? []).map((l) => [l.day, l.kind]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start on the Monday on/before 90 days ago so weeks align.
  const start = daysAgo(90);
  const startDow = start.getDay() === 0 ? 7 : start.getDay();
  start.setDate(start.getDate() - (startDow - 1));

  const weeks: AttendanceCell[][] = [];
  let present = 0, unexcused = 0, pto = 0;
  for (let w = 0; w < 14; w++) {
    const week: AttendanceCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const key = isoDay(cur);
      const dow = cur.getDay(); // 0=Sun,6=Sat
      let status: AttendanceCell['status'];
      if (cur > today) status = 'future';
      else if (dow === 0 || dow === 6) status = 'off';
      else if (leaveByDay.has(key)) {
        const kind = leaveByDay.get(key)!;
        if (kind === 'unexcused') { status = 'absent'; unexcused++; }
        else { status = 'leave'; pto++; }
      } else if (presentDays.has(key)) { status = 'present'; present++; }
      else status = 'off'; // no shift that weekday — not counted against attendance
      week.push({ date: key, status });
    }
    weeks.push(week);
  }
  const rate = present + unexcused > 0 ? Math.round((present / (present + unexcused)) * 100) : 100;
  return { rate, present, unexcused, pto, weeks };
}

// ── header ───────────────────────────────────────────────────────────────────
export type StaffHeader = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  handle: string | null;
  role: CenterRole;
  roomName: string | null;
  isSelf: boolean;
  admin: boolean;
  clockedIn: boolean;
  hireDate: string | null;
  tenureYears: number;
  attendancePct: number;
  expiringCreds: number;
  profile: StaffProfileRow | null;
  score: TeacherScoreRow | null;
};

export async function getStaffHeader(userId: string): Promise<StaffHeader | null> {
  const v = await resolveViewer(userId);
  if (!v) return null;
  const { service, centerId, isSelf, admin } = v;

  const { data: u } = await service.from('users').select('full_name, email, phone, handle').eq('id', userId).single();
  if (!u) return null;

  const { data: roster } = await service
    .from('classroom_staff')
    .select('classrooms(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  const roomRel = roster ? (Array.isArray(roster.classrooms) ? roster.classrooms[0] : roster.classrooms) : null;

  const { data: open } = await service
    .from('time_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .is('clocked_out_at', null)
    .gte('clocked_in_at', daysAgo(1).toISOString())
    .limit(1);

  const { data: emp } = await service
    .from('employment_history')
    .select('start_date')
    .eq('user_id', userId)
    .is('end_date', null)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: membership } = await service
    .from('center_memberships')
    .select('joined_at')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .maybeSingle();
  const hireDate = emp?.start_date ?? (membership?.joined_at ? isoDay(new Date(membership.joined_at)) : null);
  const tenureYears = hireDate ? Math.max(0, Math.floor((Date.now() - new Date(hireDate).getTime()) / (365.25 * 86_400_000))) : 0;

  const { data: creds } = await service.from('credentials').select('expires_at').eq('user_id', userId).is('deleted_at', null);
  const expiringCreds = (creds ?? []).filter((c) => {
    const s = computeCredentialStatus(c.expires_at);
    return s === 'expiring_soon' || s === 'expired';
  }).length;

  const { data: profile } = await service.from('staff_profiles').select('*').eq('user_id', userId).eq('center_id', centerId).maybeSingle();
  const { data: score } = await service.from('teacher_scores').select('*').eq('user_id', userId).eq('center_id', centerId).maybeSingle();

  const attendance = await computeAttendance(service, userId, centerId);

  return {
    userId,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    handle: u.handle,
    role: v.targetRole,
    roomName: (roomRel as { name: string } | null)?.name ?? null,
    isSelf,
    admin,
    clockedIn: (open ?? []).length > 0,
    hireDate,
    tenureYears,
    attendancePct: attendance.rate,
    expiringCreds,
    profile: (profile as StaffProfileRow | null) ?? null,
    score: (score as TeacherScoreRow | null) ?? null,
  };
}

// ── schedule ─────────────────────────────────────────────────────────────────
export type ScheduleDay = { day: number; startSlot: number; endSlot: number } | { day: number; startSlot: null; endSlot: null };
export type StaffSchedule = { rosterEntryId: string | null; roomName: string | null; days: ScheduleDay[]; operatingDays: number[] };

export async function getStaffSchedule(userId: string): Promise<StaffSchedule | null> {
  const v = await resolveViewer(userId);
  if (!v) return null;
  const { service, centerId } = v;

  const { data: center } = await service.from('centers').select('operating_days').eq('id', centerId).single();
  const operatingDays = center?.operating_days ?? [1, 2, 3, 4, 5];

  const { data: roster } = await service
    .from('classroom_staff')
    .select('id, classrooms(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!roster) return { rosterEntryId: null, roomName: null, days: [], operatingDays };
  const roomRel = Array.isArray(roster.classrooms) ? roster.classrooms[0] : roster.classrooms;

  const { data: slots } = await service
    .from('staff_shift_slots')
    .select('day_of_week, slot')
    .eq('classroom_staff_id', roster.id);
  const byDay = new Map<number, number[]>();
  for (const s of slots ?? []) {
    const arr = byDay.get(s.day_of_week) ?? [];
    arr.push(s.slot);
    byDay.set(s.day_of_week, arr);
  }
  const days: ScheduleDay[] = operatingDays.map((day: number) => {
    const arr = byDay.get(day);
    if (!arr || arr.length === 0) return { day, startSlot: null, endSlot: null };
    return { day, startSlot: Math.min(...arr), endSlot: Math.max(...arr) + 1 };
  });

  return { rosterEntryId: roster.id, roomName: (roomRel as { name: string } | null)?.name ?? null, days, operatingDays };
}

// ── credentials ──────────────────────────────────────────────────────────────
export type StaffCredential = { id: string; typeLabel: string; issuing_org: string; issued_at: string; expires_at: string | null; status: CredentialStatus };

export async function getStaffCredentials(userId: string): Promise<StaffCredential[]> {
  const v = await resolveViewer(userId);
  if (!v) return [];
  const { data } = await v.service
    .from('credentials')
    .select('id, credential_type, issuing_org, issued_at, expires_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('issued_at', { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    typeLabel: CREDENTIAL_TYPE_LABELS[c.credential_type as CredentialType] ?? 'Credential',
    issuing_org: c.issuing_org,
    issued_at: c.issued_at,
    expires_at: c.expires_at,
    status: computeCredentialStatus(c.expires_at),
  }));
}

// ── attendance tab ───────────────────────────────────────────────────────────
export async function getStaffAttendance(userId: string): Promise<AttendanceData | null> {
  const v = await resolveViewer(userId);
  if (!v) return null;
  return computeAttendance(v.service, userId, v.centerId);
}

// ── time history (current biweekly pay period) ───────────────────────────────
export type Punch = { date: string; inAt: string; outAt: string | null; minutes: number | null; status: 'on_time' | 'half_day' | 'adj_pending' | 'open' };
export type TimeHistory = { periodStart: string; periodEnd: string; totalHours: number; overtimeHours: number; adjPending: number; adjApproved: number; punches: Punch[] };

export async function getStaffTimeHistory(userId: string): Promise<TimeHistory | null> {
  const v = await resolveViewer(userId);
  if (!v) return null;
  const { service, centerId } = v;

  const periodStart = daysAgo(13);
  const { data: entries } = await service
    .from('time_entries')
    .select('id, clocked_in_at, clocked_out_at')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .gte('clocked_in_at', periodStart.toISOString())
    .order('clocked_in_at', { ascending: false });

  const { data: corrections } = await service
    .from('staff_requests')
    .select('status, for_date')
    .eq('user_id', userId)
    .eq('center_id', centerId)
    .eq('type', 'time_correction');
  const pendingDates = new Set((corrections ?? []).filter((c) => c.status === 'pending').map((c) => c.for_date));
  const adjPending = (corrections ?? []).filter((c) => c.status === 'pending').length;
  const adjApproved = (corrections ?? []).filter((c) => c.status === 'approved').length;

  let totalMinutes = 0;
  const weekMinutes = new Map<string, number>();
  const punches: Punch[] = (entries ?? []).map((e) => {
    const date = isoDay(new Date(e.clocked_in_at));
    const minutes = e.clocked_out_at ? Math.round((new Date(e.clocked_out_at).getTime() - new Date(e.clocked_in_at).getTime()) / 60_000) : null;
    if (minutes) {
      totalMinutes += minutes;
      const wk = new Date(e.clocked_in_at);
      const dow = wk.getDay() === 0 ? 7 : wk.getDay();
      wk.setDate(wk.getDate() - (dow - 1));
      const key = isoDay(wk);
      weekMinutes.set(key, (weekMinutes.get(key) ?? 0) + minutes);
    }
    let status: Punch['status'];
    if (!e.clocked_out_at) status = 'open';
    else if (pendingDates.has(date)) status = 'adj_pending';
    else if (minutes != null && minutes < 6 * 60) status = 'half_day';
    else status = 'on_time';
    return { date, inAt: e.clocked_in_at, outAt: e.clocked_out_at, minutes, status };
  });

  let overtimeMinutes = 0;
  for (const m of weekMinutes.values()) overtimeMinutes += Math.max(0, m - 40 * 60);

  return {
    periodStart: isoDay(periodStart),
    periodEnd: isoDay(new Date()),
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
    adjPending,
    adjApproved,
    punches,
  };
}

// ── notes (admin only) ───────────────────────────────────────────────────────
export type StaffNote = { id: string; content: string; category: NoteCategory; createdAt: string; authorName: string };

export async function getStaffNotes(userId: string): Promise<StaffNote[]> {
  const v = await resolveViewer(userId);
  if (!v || !v.admin) return []; // never runs meaningfully for the employee
  const { data } = await v.service
    .from('staff_notes')
    .select('id, content, category, created_at, written_by')
    .eq('user_id', userId)
    .eq('center_id', v.centerId)
    .order('created_at', { ascending: false });
  const notes = data ?? [];
  const authorIds = [...new Set(notes.map((n) => n.written_by))];
  const { data: authors } = authorIds.length
    ? await v.service.from('users').select('id, full_name').in('id', authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));
  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    category: n.category as NoteCategory,
    createdAt: n.created_at,
    authorName: nameById.get(n.written_by) ?? 'Admin',
  }));
}

// ── mutations ────────────────────────────────────────────────────────────────
export async function addStaffNote(userId: string, content: string, category: NoteCategory) {
  const v = await requireAdmin(userId);
  if (!content.trim()) throw new Error('Note required');
  await v.service.from('staff_notes').insert({
    user_id: userId, center_id: v.centerId, written_by: v.viewerId, content: content.trim(), category,
  });
  revalidatePath(`/staff/${userId}`);
}

async function upsertProfile(service: Service, userId: string, centerId: string, patch: Record<string, unknown>) {
  const { data: existing } = await service.from('staff_profiles').select('id').eq('user_id', userId).eq('center_id', centerId).maybeSingle();
  if (existing) {
    await service.from('staff_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await service.from('staff_profiles').insert({ user_id: userId, center_id: centerId, ...patch });
  }
}

export async function updateContact(userId: string, input: {
  phone: string | null; personal_email: string | null;
  emergency_contact_name: string | null; emergency_contact_relation: string | null; emergency_contact_phone: string | null;
}) {
  const v = await resolveViewer(userId);
  if (!v || (!v.admin && !v.isSelf)) throw new Error('Forbidden');
  await v.service.from('users').update({ phone: input.phone }).eq('id', userId);
  await upsertProfile(v.service, userId, v.centerId, {
    personal_email: input.personal_email,
    emergency_contact_name: input.emergency_contact_name,
    emergency_contact_relation: input.emergency_contact_relation,
    emergency_contact_phone: input.emergency_contact_phone,
  });
  revalidatePath(`/staff/${userId}`);
}

export async function updateAvailability(userId: string, input: {
  availability: Record<string, AvailabilityStatus>; sick_hours: number; vacation_hours: number; personal_hours: number;
}) {
  const v = await resolveViewer(userId);
  if (!v || (!v.admin && !v.isSelf)) throw new Error('Forbidden');
  await upsertProfile(v.service, userId, v.centerId, {
    availability: input.availability,
    sick_hours: input.sick_hours,
    vacation_hours: input.vacation_hours,
    personal_hours: input.personal_hours,
  });
  revalidatePath(`/staff/${userId}`);
}

export async function updateStaffBasics(userId: string, input: { full_name: string; phone: string | null; role: CenterRole }) {
  const v = await requireAdmin(userId);
  await v.service.from('users').update({ full_name: input.full_name.trim(), phone: input.phone }).eq('id', userId);
  await v.service.from('center_memberships').update({ role: input.role }).eq('user_id', userId).eq('center_id', v.centerId);
  revalidatePath(`/staff/${userId}`);
}

/** Inline schedule editor: set (or clear) one weekday's shift range on the roster entry. */
export async function updateScheduleDay(userId: string, rosterEntryId: string, day: number, startSlot: number | null, endSlot: number | null) {
  const v = await requireAdmin(userId);
  await v.service.from('staff_shift_slots').delete().eq('classroom_staff_id', rosterEntryId).eq('day_of_week', day);
  if (startSlot != null && endSlot != null && endSlot > startSlot) {
    const rows = [];
    for (let slot = startSlot; slot < endSlot; slot++) rows.push({ classroom_staff_id: rosterEntryId, day_of_week: day, slot });
    await v.service.from('staff_shift_slots').insert(rows);
  }
  revalidatePath(`/staff/${userId}`);
}

export async function removeFromCenter(userId: string) {
  const v = await requireAdmin(userId);
  await v.service.from('center_memberships').update({ left_at: new Date().toISOString() }).eq('user_id', userId).eq('center_id', v.centerId);
  revalidatePath('/staff');
}

export async function nudgeStaff(userId: string, userName: string) {
  const v = await requireAdmin(userId);
  await v.service.from('activity_log').insert({ center_id: v.centerId, actor_id: v.viewerId, event_type: 'staff.nudged', payload: { user_id: userId, user_name: userName } });
  revalidatePath(`/staff/${userId}`);
}

export async function sendStaffNotification(userId: string, userName: string, message: string) {
  const v = await requireAdmin(userId);
  await v.service.from('activity_log').insert({ center_id: v.centerId, actor_id: v.viewerId, event_type: 'staff.notified', payload: { user_id: userId, user_name: userName, message } });
}

/** Self-service: an employee messages the admins of their center (recorded now, delivery later). */
export async function messageAdmin(userId: string, message: string) {
  const v = await resolveViewer(userId);
  if (!v || !v.isSelf) throw new Error('Forbidden');
  await v.service.from('activity_log').insert({
    center_id: v.centerId, actor_id: v.viewerId, event_type: 'admin.messaged', payload: { message },
  });
}

export async function createStaffRequest(userId: string, type: StaffRequestType, details: string, forDate?: string) {
  const v = await resolveViewer(userId);
  if (!v || (!v.admin && !v.isSelf)) throw new Error('Forbidden');
  await v.service.from('staff_requests').insert({
    user_id: userId, center_id: v.centerId, type, details: details.trim() || null,
    for_date: forDate ?? null, created_by: v.viewerId,
  });
  revalidatePath('/requests');
  revalidatePath(`/staff/${userId}`);
}
