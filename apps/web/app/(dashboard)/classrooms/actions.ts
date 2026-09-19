'use server';

import { revalidatePath } from 'next/cache';
import { getRatioRule, getRatioCitation } from '@kinderbase/core';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import {
  isAdmin,
  deriveOccPosition,
  type AgeGroup,
  type CenterRole,
  type OccPositionCode,
  type ClassroomStaffingView,
  type StaffingRosterEntry,
} from '@kinderbase/types';

export type ClassroomHours = { openSlot: number; closeSlot: number; operatingDays: number[] };
export type ClassroomHoursInfo = { effective: ClassroomHours; center: ClassroomHours; overridden: boolean };

type HoursFormResult =
  | { kind: 'absent' }
  | { kind: 'inherit' }
  | { kind: 'custom'; open: number; close: number; days: number[] };

/** Parses the hours override the ClassroomForm/inline editor puts on FormData. */
function parseHoursForm(formData: FormData): HoursFormResult {
  const mode = formData.get('hours_mode');
  if (mode == null) return { kind: 'absent' };
  if (mode !== 'custom') return { kind: 'inherit' };
  const open = parseInt(formData.get('open_slot') as string, 10);
  const close = parseInt(formData.get('close_slot') as string, 10);
  const days = String(formData.get('operating_days') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((d) => d >= 1 && d <= 7);
  if (Number.isNaN(open) || Number.isNaN(close) || open < 0 || close > 48 || open >= close || days.length === 0) {
    throw new Error('Invalid hours');
  }
  return { kind: 'custom', open, close, days: [...new Set(days)].sort((a, b) => a - b) };
}

export async function createClassroom(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const hours = parseHoursForm(formData);
  if (hours.kind === 'custom') {
    const ctx = getActiveContextFromCookies();
    if (!ctx || !isAdmin(ctx.role)) throw new Error('Forbidden');
  }

  await supabase.from('classrooms').insert({
    center_id: formData.get('center_id') as string,
    name: formData.get('name') as string,
    age_group: formData.get('age_group') as AgeGroup,
    licensed_capacity: parseInt(formData.get('licensed_capacity') as string),
    typical_enrollment: parseInt(formData.get('typical_enrollment') as string) || 0,
    open_slot: hours.kind === 'custom' ? hours.open : null,
    close_slot: hours.kind === 'custom' ? hours.close : null,
    operating_days: hours.kind === 'custom' ? hours.days : null,
  });

  revalidatePath('/classrooms');
}

export async function updateClassroom(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const hours = parseHoursForm(formData);

  const update: {
    name: string;
    age_group: AgeGroup;
    licensed_capacity: number;
    typical_enrollment: number;
    open_slot?: number | null;
    close_slot?: number | null;
    operating_days?: number[] | null;
  } = {
    name: formData.get('name') as string,
    age_group: formData.get('age_group') as AgeGroup,
    licensed_capacity: parseInt(formData.get('licensed_capacity') as string),
    typical_enrollment: parseInt(formData.get('typical_enrollment') as string) || 0,
  };
  if (hours.kind === 'custom') {
    update.open_slot = hours.open;
    update.close_slot = hours.close;
    update.operating_days = hours.days;
  } else if (hours.kind === 'inherit') {
    update.open_slot = null;
    update.close_slot = null;
    update.operating_days = null;
  }

  await supabase.from('classrooms').update(update).eq('id', id);

  // Hours changes can orphan out-of-window staffing data — reconcile (admin-gated).
  if (hours.kind !== 'absent') {
    const { service } = await requireClassroomAdmin(id);
    const eff = await effectiveHoursFor(service, id);
    await trimStaffingToWindow(service, id, eff.openSlot, eff.closeSlot, eff.operatingDays);
  }

  revalidatePath('/classrooms');
  revalidatePath(`/classrooms/${id}`);
}

export async function deleteClassroom(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase.from('classrooms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/classrooms');
}

export async function upsertStaffingPattern(
  classroomId: string,
  dayOfWeek: number,
  hour: number,
  staffCount: number
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase.from('staffing_patterns').upsert(
    { classroom_id: classroomId, day_of_week: dayOfWeek, hour, staff_count: staffCount },
    { onConflict: 'classroom_id,day_of_week,hour' }
  );
}

export async function getClassrooms(centerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('classrooms')
    .select('*')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');
  return data ?? [];
}

export type CenterMemberOption = {
  userId: string;
  fullName: string;
  role: CenterRole;
};

export type ClassroomRatioInfo = {
  mode: 'auto' | 'manual';
  childrenPerStaff: number;
  maxGroup: number;
  citation: string;
};

export type ClassroomStaffingData = {
  view: ClassroomStaffingView;
  canEdit: boolean;
  members: CenterMemberOption[];
  hours: ClassroomHoursInfo;
  ratio: ClassroomRatioInfo;
};

/**
 * Assembles the full staffing-pattern view + center members for a classroom,
 * using the service client (roster names + member roles cross RLS, like
 * getStaffPins does). Caller is responsible for authorization.
 */
async function buildStaffingView(
  service: ReturnType<typeof createServiceClient>,
  id: string
): Promise<{ view: ClassroomStaffingView; members: CenterMemberOption[]; hours: ClassroomHoursInfo; ratio: ClassroomRatioInfo } | null> {
  const { data: classroom } = await service
    .from('classrooms')
    .select('*, centers(state, open_slot, close_slot, operating_days)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!classroom) return null;

  const center = Array.isArray(classroom.centers) ? classroom.centers[0] : classroom.centers;
  const centerHours = center as
    | { state: string; open_slot: number; close_slot: number; operating_days: number[] }
    | null;
  const state = centerHours?.state ?? 'MD';
  const ageGroup = classroom.age_group as AgeGroup;

  // Effective hours: classroom override (all-or-nothing) falls back to the center.
  const centerHoursInfo: ClassroomHours = {
    openSlot: centerHours?.open_slot ?? 12,
    closeSlot: centerHours?.close_slot ?? 38,
    operatingDays: centerHours?.operating_days ?? [1, 2, 3, 4, 5],
  };
  const overridden = classroom.open_slot != null;
  const effectiveHours: ClassroomHours = overridden
    ? {
        openSlot: classroom.open_slot as number,
        closeSlot: classroom.close_slot as number,
        operatingDays: (classroom.operating_days as number[]) ?? [],
      }
    : centerHoursInfo;
  const hours: ClassroomHoursInfo = { effective: effectiveHours, center: centerHoursInfo, overridden };

  // Center members: for the roster's derived positions and the add-staff picker.
  const { data: membershipRows } = await service
    .from('center_memberships')
    .select('role, users(id, full_name)')
    .eq('center_id', classroom.center_id)
    .is('left_at', null);

  const roleByUser = new Map<string, CenterRole>();
  const members: CenterMemberOption[] = [];
  for (const m of membershipRows ?? []) {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    if (!u?.id) continue;
    roleByUser.set(u.id, m.role as CenterRole);
    members.push({ userId: u.id, fullName: u.full_name ?? '', role: m.role as CenterRole });
  }
  members.sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Roster + presence cells.
  const { data: staffRows } = await service
    .from('classroom_staff')
    .select('id, user_id, staff_name, position_code, sort_order, users(full_name)')
    .eq('classroom_id', id)
    .order('sort_order');

  const rosterIds = (staffRows ?? []).map((r) => r.id);
  const { data: slotRows } = rosterIds.length
    ? await service
        .from('staff_shift_slots')
        .select('classroom_staff_id, day_of_week, slot')
        .in('classroom_staff_id', rosterIds)
    : { data: [] as { classroom_staff_id: string; day_of_week: number; slot: number }[] };

  const slotsByStaff = new Map<string, Record<number, number[]>>();
  for (const s of slotRows ?? []) {
    const byDay = slotsByStaff.get(s.classroom_staff_id) ?? {};
    (byDay[s.day_of_week] ??= []).push(s.slot);
    slotsByStaff.set(s.classroom_staff_id, byDay);
  }

  const roster: StaffingRosterEntry[] = (staffRows ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const override = (r.position_code as OccPositionCode | null) ?? null;
    const derived = r.user_id
      ? deriveOccPosition(roleByUser.get(r.user_id) ?? 'aide', ageGroup)
      : 'A';
    return {
      id: r.id,
      userId: r.user_id,
      displayName: u?.full_name ?? r.staff_name ?? 'Unknown',
      positionCode: override ?? derived,
      positionOverride: override,
      sortOrder: r.sort_order,
      slotsByDay: slotsByStaff.get(r.id) ?? {},
    };
  });

  // Child counts.
  const { data: countRows } = await service
    .from('classroom_child_counts')
    .select('day_of_week, slot, total_children')
    .eq('classroom_id', id);

  const childCountsByDay: Record<number, Record<number, number>> = {};
  for (const c of countRows ?? []) {
    (childCountsByDay[c.day_of_week] ??= {})[c.slot] = c.total_children;
  }

  const view: ClassroomStaffingView = {
    classroomId: classroom.id,
    name: classroom.name,
    ageGroup,
    licensedCapacity: classroom.licensed_capacity,
    typicalEnrollment: classroom.typical_enrollment,
    patternEffectiveDate: classroom.pattern_effective_date ?? null,
    state,
    openSlot: effectiveHours.openSlot,
    closeSlot: effectiveHours.closeSlot,
    operatingDays: effectiveHours.operatingDays,
    roster,
    childCountsByDay,
  };

  // Ratio mode: Manual override (all-or-none) or Auto (COMAR default).
  const ratioOverridden = classroom.ratio_children_per_staff != null;
  const defaultRule = getRatioRule(ageGroup, state);
  const ratio: ClassroomRatioInfo = {
    mode: ratioOverridden ? 'manual' : 'auto',
    childrenPerStaff: ratioOverridden ? (classroom.ratio_children_per_staff as number) : defaultRule.childrenPerStaff,
    maxGroup: ratioOverridden ? (classroom.ratio_max_group as number) : defaultRule.maxGroupSize,
    citation: getRatioCitation(ageGroup, state),
  };

  return { view, members, hours, ratio };
}

/**
 * Loads the full staffing-pattern view for a classroom. Verifies the caller is an
 * active member of the classroom's center, then assembles the view.
 */
export async function getClassroom(id: string): Promise<ClassroomStaffingData | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();

  const { data: classroom } = await service
    .from('classrooms')
    .select('center_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!classroom) return null;

  const { data: membership } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', classroom.center_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!membership) return null;

  const result = await buildStaffingView(service, id);
  if (!result) return null;

  return {
    view: result.view,
    canEdit: isAdmin(membership.role as CenterRole),
    members: result.members,
    hours: result.hours,
    ratio: result.ratio,
  };
}

// ── Staffing-pattern save (admin-only, active-center scoped) ────────────────

/**
 * Authorizes an admin mutation on a classroom: caller is authenticated, active
 * context is admin, and the classroom belongs to that active center. Returns a
 * service client for the write (authorization already enforced here).
 */
async function requireClassroomAdmin(classroomId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const ctx = getActiveContextFromCookies();
  if (!ctx || !isAdmin(ctx.role)) throw new Error('Forbidden');

  const service = createServiceClient();
  const { data: classroom } = await service
    .from('classrooms')
    .select('center_id')
    .eq('id', classroomId)
    .single();
  if (!classroom || classroom.center_id !== ctx.centerId) throw new Error('Forbidden');

  return { service, ctx };
}

/** Resolves a classroom's effective hours (override, else its center's default). */
async function effectiveHoursFor(
  service: ReturnType<typeof createServiceClient>,
  classroomId: string
): Promise<ClassroomHours> {
  const { data: classroom } = await service
    .from('classrooms')
    .select('open_slot, close_slot, operating_days, centers(open_slot, close_slot, operating_days)')
    .eq('id', classroomId)
    .single();
  if (classroom?.open_slot != null) {
    return {
      openSlot: classroom.open_slot,
      closeSlot: classroom.close_slot as number,
      operatingDays: (classroom.operating_days as number[]) ?? [],
    };
  }
  const center = Array.isArray(classroom?.centers) ? classroom?.centers[0] : classroom?.centers;
  return {
    openSlot: (center as { open_slot: number } | null)?.open_slot ?? 12,
    closeSlot: (center as { close_slot: number } | null)?.close_slot ?? 38,
    operatingDays: (center as { operating_days: number[] } | null)?.operating_days ?? [1, 2, 3, 4, 5],
  };
}

/**
 * Deletes staffing data that falls outside a classroom's operating window: shift
 * cells and child counts on days not operating, or in slots before open / at-or-
 * after close. Partial shifts keep their in-range slots (per-slot delete).
 */
async function trimStaffingToWindow(
  service: ReturnType<typeof createServiceClient>,
  classroomId: string,
  open: number,
  close: number,
  days: number[]
) {
  const dayList = `(${days.join(',')})`;

  const { data: roster } = await service
    .from('classroom_staff')
    .select('id')
    .eq('classroom_id', classroomId);
  const rosterIds = (roster ?? []).map((r) => r.id);
  if (rosterIds.length) {
    await service.from('staff_shift_slots').delete().in('classroom_staff_id', rosterIds).not('day_of_week', 'in', dayList);
    await service.from('staff_shift_slots').delete().in('classroom_staff_id', rosterIds).lt('slot', open);
    await service.from('staff_shift_slots').delete().in('classroom_staff_id', rosterIds).gte('slot', close);
  }

  await service.from('classroom_child_counts').delete().eq('classroom_id', classroomId).not('day_of_week', 'in', dayList);
  await service.from('classroom_child_counts').delete().eq('classroom_id', classroomId).lt('slot', open);
  await service.from('classroom_child_counts').delete().eq('classroom_id', classroomId).gte('slot', close);
}

/**
 * Sets a classroom's hours override (null = inherit the center) and reconciles the
 * staffing pattern to the new effective window. Admin-only, active-center scoped.
 */
export async function updateClassroomHours(
  classroomId: string,
  override: ClassroomHours | null
) {
  const { service } = await requireClassroomAdmin(classroomId);

  if (override) {
    const days = [...new Set(override.operatingDays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
    if (override.openSlot < 0 || override.closeSlot > 48 || override.openSlot >= override.closeSlot || days.length === 0) {
      throw new Error('Invalid hours');
    }
    await service
      .from('classrooms')
      .update({ open_slot: override.openSlot, close_slot: override.closeSlot, operating_days: days })
      .eq('id', classroomId);
  } else {
    await service
      .from('classrooms')
      .update({ open_slot: null, close_slot: null, operating_days: null })
      .eq('id', classroomId);
  }

  const eff = await effectiveHoursFor(service, classroomId);
  await trimStaffingToWindow(service, classroomId, eff.openSlot, eff.closeSlot, eff.operatingDays);

  revalidatePath(`/classrooms/${classroomId}`);
}

export type SaveStaffingPayload = {
  roster: Array<{
    id: string;
    isNew: boolean;
    userId: string | null;
    staffName: string | null;
    positionCode: OccPositionCode;
    slotsByDay: Record<number, number[]>;
  }>;
  childCountsByDay: Record<number, Record<number, number>>;
};

/**
 * Persists a whole staffing pattern in one shot (replace-all): reconciles the
 * roster (add/remove/update), then replaces all shift cells and child counts to
 * match the draft. Returns the re-assembled view (with real ids) as the new
 * baseline. Admin-only and scoped to the active center.
 */
export async function saveStaffingPattern(
  classroomId: string,
  payload: SaveStaffingPayload
): Promise<ClassroomStaffingView> {
  const { service } = await requireClassroomAdmin(classroomId);

  // 1. Existing roster rows.
  const { data: existing } = await service
    .from('classroom_staff')
    .select('id')
    .eq('classroom_id', classroomId);
  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const keptIds = new Set(payload.roster.filter((r) => !r.isNew).map((r) => r.id));

  // 2. Delete removed rows (cascade removes their shift slots).
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length) {
    await service.from('classroom_staff').delete().in('id', toDelete);
  }

  // 3 + 4. Insert new rows (map temp→real id) and update kept rows' position/order.
  const idMap = new Map<string, string>();
  for (let i = 0; i < payload.roster.length; i++) {
    const r = payload.roster[i]!;
    if (r.isNew) {
      const { data, error } = await service
        .from('classroom_staff')
        .insert({
          classroom_id: classroomId,
          user_id: r.userId,
          staff_name: r.userId ? null : (r.staffName?.trim() || null),
          position_code: r.positionCode,
          sort_order: i,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      idMap.set(r.id, data.id);
    } else {
      idMap.set(r.id, r.id);
      await service
        .from('classroom_staff')
        .update({ position_code: r.positionCode, sort_order: i })
        .eq('id', r.id);
    }
  }

  // 5. Replace shift cells for the current roster.
  const realRosterIds = payload.roster.map((r) => idMap.get(r.id)!);
  if (realRosterIds.length) {
    await service.from('staff_shift_slots').delete().in('classroom_staff_id', realRosterIds);
  }
  const slotRows: { classroom_staff_id: string; day_of_week: number; slot: number }[] = [];
  for (const r of payload.roster) {
    const realId = idMap.get(r.id)!;
    for (const [day, slots] of Object.entries(r.slotsByDay)) {
      for (const slot of slots) {
        slotRows.push({ classroom_staff_id: realId, day_of_week: Number(day), slot });
      }
    }
  }
  if (slotRows.length) {
    await service
      .from('staff_shift_slots')
      .upsert(slotRows, { onConflict: 'classroom_staff_id,day_of_week,slot', ignoreDuplicates: true });
  }

  // 6. Replace child counts.
  await service.from('classroom_child_counts').delete().eq('classroom_id', classroomId);
  const countRows: { classroom_id: string; day_of_week: number; slot: number; total_children: number }[] = [];
  for (const [day, slots] of Object.entries(payload.childCountsByDay)) {
    for (const [slot, total] of Object.entries(slots)) {
      const safe = Math.max(0, Math.min(999, Math.floor(total) || 0));
      if (safe > 0) {
        countRows.push({
          classroom_id: classroomId,
          day_of_week: Number(day),
          slot: Number(slot),
          total_children: safe,
        });
      }
    }
  }
  if (countRows.length) {
    await service.from('classroom_child_counts').insert(countRows);
  }

  revalidatePath(`/classrooms/${classroomId}`);

  const result = await buildStaffingView(service, classroomId);
  if (!result) throw new Error('Failed to reload pattern after save');
  return result.view;
}
