'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, nextAgeTransition, BAND_LABEL, canSee, isoDate, BUILTIN_CAL_TYPES, type CalItem, type CalType, type Audience } from '@kinderbase/core';
import { isAdmin, computeCredentialStatus, childDisplayName, type CenterRole } from '@kinderbase/types';
import { resolveApproval } from '@/app/(mobile)/m/admin/approvals-actions';

type Service = ReturnType<typeof createServiceClient>;
type Ctx = { service: Service; userId: string; centerId: string; role: CenterRole; admin: boolean; audience: Audience };

async function ctx(): Promise<Ctx | null> {
  const active = getActiveContextFromCookies();
  if (!active) return null;
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  const admin = isAdmin(active.role);
  return { service: createServiceClient(), userId: user.id, centerId: active.centerId, role: active.role, admin, audience: admin ? 'admin' : 'staff' };
}

const BUILTIN_BY_KEY = Object.fromEntries(BUILTIN_CAL_TYPES.map((t) => [t.key, t]));

async function loadTypes(c: Ctx): Promise<{ types: CalType[]; byKey: Record<string, CalType> }> {
  const { data } = await c.service.from('calendar_event_types').select('*').or(`center_id.is.null,center_id.eq.${c.centerId}`).order('sort_order');
  const byKey: Record<string, CalType> = {};
  for (const r of data ?? []) {
    const t: CalType = { key: r.key, label: r.label, colour: r.colour, icon: r.icon, isSystem: r.is_system, isDerived: r.is_derived, visibleAdmin: r.visible_admin, visibleStaff: r.visible_staff, visibleFamily: r.visible_family };
    // A center-specific override wins over the built-in of the same key.
    if (!byKey[r.key] || r.center_id) byKey[r.key] = t;
  }
  const types = Object.values(byKey).sort((a, b) => (BUILTIN_BY_KEY[a.key]?.key ? 0 : 1) - (BUILTIN_BY_KEY[b.key]?.key ? 0 : 1));
  return { types, byKey };
}

export type CalendarResult = { items: (CalItem & { colour: string; icon: string; typeLabel: string })[]; types: CalType[] };

export async function getCalendar({ from, to }: { from: string; to: string }): Promise<CalendarResult | null> {
  const c = await ctx();
  if (!c) return null;
  const { service, centerId, userId, audience } = c;
  const clock = getClock();
  const { types, byKey } = await loadTypes(c);

  const items: CalItem[] = [];

  // 1. Stored events in range.
  const { data: events } = await service
    .from('calendar_events')
    .select('id, title, detail, starts_on, ends_on, time_label, classroom_ids, child_id, user_id, calendar_event_types(key)')
    .eq('center_id', centerId)
    .gte('starts_on', from)
    .lte('starts_on', to)
    .order('starts_on');
  for (const e of events ?? []) {
    const t = Array.isArray(e.calendar_event_types) ? e.calendar_event_types[0] : e.calendar_event_types;
    if (!t) continue;
    items.push({ id: e.id, date: e.starts_on, endDate: e.ends_on ?? undefined, typeKey: t.key, title: e.title, detail: e.detail ?? undefined, timeLabel: e.time_label ?? undefined, classroomIds: e.classroom_ids ?? [], childId: e.child_id ?? undefined, userId: e.user_id ?? undefined });
  }

  // Center rooms + live inputs (reused by coverage notes + age transitions).
  const { data: classrooms } = await service.from('classrooms').select('id, name').eq('center_id', centerId).is('deleted_at', null);
  const rooms = classrooms ?? [];
  const roomInputs = new Map<string, Awaited<ReturnType<typeof loadRoomInput>>>();
  const roomNameOfUser = new Map<string, { roomId: string; name: string }>();
  const { data: roster } = rooms.length ? await service.from('classroom_staff').select('user_id, classroom_id').in('classroom_id', rooms.map((r) => r.id)) : { data: [] as { user_id: string | null; classroom_id: string }[] };
  for (const r of roster ?? []) {
    if (r.user_id && !roomNameOfUser.has(r.user_id)) {
      const room = rooms.find((x) => x.id === r.classroom_id);
      if (room) roomNameOfUser.set(r.user_id, { roomId: room.id, name: room.name });
    }
  }

  // 2. Time off — pending/decided leave & schedule requests, with a coverage note.
  const { data: reqs } = await service
    .from('staff_requests')
    .select('id, user_id, type, for_date, status, users!staff_requests_user_id_fkey(full_name)')
    .eq('center_id', centerId)
    .in('type', ['leave', 'schedule'])
    .not('for_date', 'is', null)
    .gte('for_date', from)
    .lte('for_date', to);
  for (const r of reqs ?? []) {
    if (!r.for_date) continue;
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const name = u?.full_name ?? 'Staff';
    let coverageNote: string | undefined;
    const room = r.user_id ? roomNameOfUser.get(r.user_id) : undefined;
    if (r.status === 'pending' && room) {
      if (!roomInputs.has(room.roomId)) roomInputs.set(room.roomId, await loadRoomInput(room.roomId, clock, service));
      const input = roomInputs.get(room.roomId);
      if (input) {
        const without = evaluate({ ...input, staff: input.staff.filter((s) => s.id !== r.user_id) });
        if (!without.ok) coverageNote = `${room.name} would be short — ${without.checks.find((ck) => !ck.pass)?.message ?? 'coverage needed'}`;
      }
    }
    items.push({
      id: r.id,
      date: r.for_date,
      typeKey: 'timeoff',
      title: `${name} · ${r.type === 'leave' ? 'time off' : 'schedule change'}`,
      userId: r.user_id ?? undefined,
      status: r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'denied' : 'pending',
      derived: true,
      coverageNote,
      coverageRoomId: room?.roomId,
      coverageRoomName: room?.name,
    });
  }

  // 3. Credential expiries → licensing (admin + the owner).
  const { data: memberIds } = await service.from('center_memberships').select('user_id').eq('center_id', centerId).is('left_at', null);
  const ids = (memberIds ?? []).map((m) => m.user_id);
  if (ids.length) {
    const { data: creds } = await service
      .from('credentials')
      .select('id, user_id, credential_type, custom_type_name, expires_at, users(full_name)')
      .in('user_id', ids)
      .is('deleted_at', null)
      .not('expires_at', 'is', null)
      .gte('expires_at', from)
      .lte('expires_at', to);
    for (const cr of creds ?? []) {
      if (!cr.expires_at) continue;
      const u = Array.isArray(cr.users) ? cr.users[0] : cr.users;
      const label = cr.custom_type_name ?? cr.credential_type.replace(/_/g, ' ');
      items.push({ id: cr.id, date: cr.expires_at, typeKey: 'licensing', title: `${u?.full_name ?? 'Staff'} · ${label} expires`, userId: cr.user_id, derived: true });
    }
  }

  // 4. Age transitions → ratio (engine-generated).
  for (const room of rooms) {
    if (!roomInputs.has(room.id)) roomInputs.set(room.id, await loadRoomInput(room.id, clock, service));
    const input = roomInputs.get(room.id);
    if (!input) continue;
    const t = nextAgeTransition(input);
    if (!t) continue;
    const when = new Date(clock.now());
    when.setDate(when.getDate() + t.inDays);
    const whenIso = isoDate(when.getFullYear(), when.getMonth(), when.getDate());
    if (whenIso < from || whenIso > to) continue;
    const { data: child } = await service.from('children').select('first_name, last_name').eq('id', t.childId).maybeSingle();
    const first = child ? childDisplayName(child).split(' ')[0] : 'A child';
    items.push({ date: whenIso, typeKey: 'ratio', title: `${first} becomes a ${BAND_LABEL[t.to]}`, detail: `${room.name} → needs ${t.after.minStaff} staff (now ${t.before.minStaff})`, derived: true, engine: true });
  }

  // 5. Birthdays → bday_s (respecting birthday_visible).
  const fromY = Number(from.slice(0, 4));
  const { data: kids } = await service.from('children').select('id, first_name, last_name, birthdate, birthday_visible').eq('center_id', centerId).is('deleted_at', null).eq('birthday_visible', true);
  for (const k of kids ?? []) {
    if (!k.birthdate) continue;
    const [, mm, dd] = k.birthdate.split('-');
    // Try the birthday in each year the [from,to] window can touch.
    for (const y of [fromY, fromY + 1]) {
      const bIso = `${y}-${mm}-${dd}`;
      if (bIso >= from && bIso <= to) {
        const age = y - Number(k.birthdate.slice(0, 4));
        items.push({ id: `bday-${k.id}`, date: bIso, typeKey: 'bday_s', title: `${childDisplayName(k)} turns ${age}`, childId: k.id, derived: true });
      }
    }
  }

  // Server-side visibility filter (the whole permission model).
  const visible = items.filter((item) => {
    const t = byKey[item.typeKey];
    return t ? canSee(t, audience, { viewerId: userId, item }) : false;
  });
  const decorated = visible.map((item) => {
    const t = byKey[item.typeKey]!;
    return { ...item, colour: t.colour, icon: t.icon, typeLabel: t.label };
  });
  decorated.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { items: decorated, types };
}

// ── Mutations (director/admin) ───────────────────────────────────────────────
async function requireAdminCtx(): Promise<Ctx> {
  const c = await ctx();
  if (!c || !c.admin) throw new Error('Only management can change the calendar.');
  return c;
}

async function typeIdForKey(c: Ctx, key: string): Promise<string | null> {
  const { data } = await c.service.from('calendar_event_types').select('id, center_id').eq('key', key).or(`center_id.is.null,center_id.eq.${c.centerId}`);
  const rows = data ?? [];
  const pref = rows.find((r) => r.center_id === c.centerId) ?? rows[0];
  return pref?.id ?? null;
}

export async function createEvent(input: { typeKey: string; title: string; detail?: string; startsOn: string; endsOn?: string; timeLabel?: string; classroomIds?: string[] }): Promise<void> {
  const c = await requireAdminCtx();
  if (!input.title.trim()) throw new Error('Give the event a title.');
  const typeId = await typeIdForKey(c, input.typeKey);
  if (!typeId) throw new Error('Unknown event type.');
  const { error } = await c.service.from('calendar_events').insert({
    center_id: c.centerId,
    type_id: typeId,
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    time_label: input.timeLabel?.trim() || null,
    classroom_ids: input.classroomIds ?? [],
    created_by: c.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

export async function updateEvent(id: string, patch: { title?: string; detail?: string; startsOn?: string; endsOn?: string | null; timeLabel?: string | null }): Promise<void> {
  const c = await requireAdminCtx();
  const { error } = await c.service
    .from('calendar_events')
    .update({ title: patch.title, detail: patch.detail, starts_on: patch.startsOn, ends_on: patch.endsOn, time_label: patch.timeLabel })
    .eq('id', id)
    .eq('center_id', c.centerId);
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

export async function deleteEvent(id: string): Promise<void> {
  const c = await requireAdminCtx();
  await c.service.from('calendar_events').delete().eq('id', id).eq('center_id', c.centerId);
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

export async function createType(input: { label: string; colour: string; icon: string; visibleStaff: boolean }): Promise<void> {
  const c = await requireAdminCtx();
  const label = input.label.trim();
  if (!label) throw new Error('Give the type a name.');
  const key = 'c_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24);
  const { error } = await c.service.from('calendar_event_types').insert({
    center_id: c.centerId,
    key,
    label,
    colour: input.colour,
    icon: input.icon,
    is_system: false,
    is_derived: false,
    visible_admin: true,
    visible_staff: input.visibleStaff,
    visible_family: false,
    sort_order: 100,
    created_by: c.userId,
  });
  if (error) throw new Error(error.code === '23505' ? 'You already have a type with that name.' : error.message);
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

/** Toggle staff-visibility of a type for THIS center (built-ins get a center override row). */
export async function setTypeVisibility(key: string, visibleStaff: boolean): Promise<void> {
  const c = await requireAdminCtx();
  const builtin = BUILTIN_BY_KEY[key];
  const { data: existing } = await c.service.from('calendar_event_types').select('id').eq('center_id', c.centerId).eq('key', key).maybeSingle();
  if (existing) {
    await c.service.from('calendar_event_types').update({ visible_staff: visibleStaff }).eq('id', existing.id);
  } else if (builtin) {
    await c.service.from('calendar_event_types').insert({ center_id: c.centerId, key, label: builtin.label, colour: builtin.colour, icon: builtin.icon, is_system: false, is_derived: builtin.isDerived, visible_admin: true, visible_staff: visibleStaff, visible_family: builtin.visibleFamily, sort_order: 0, created_by: c.userId });
  }
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

export async function deleteType(key: string): Promise<void> {
  const c = await requireAdminCtx();
  // Only custom (non-system) center types may be deleted; events cascade via FK.
  await c.service.from('calendar_event_types').delete().eq('center_id', c.centerId).eq('key', key).eq('is_system', false);
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}

export async function countTypeEvents(key: string): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  const typeId = await typeIdForKey(c, key);
  if (!typeId) return 0;
  const { count } = await c.service.from('calendar_events').select('id', { count: 'exact', head: true }).eq('center_id', c.centerId).eq('type_id', typeId);
  return count ?? 0;
}

/** Approve/deny a pending leave/schedule request from the calendar — delegates to
 *  the same resolver the Inbox uses, so the two can never disagree. */
export async function decideTimeOff(requestId: string, approve: boolean): Promise<void> {
  const c = await ctx();
  if (!c || !c.admin) throw new Error('Forbidden');
  await resolveApproval(`req:${requestId}`, approve ? 'approved' : 'rejected');
  revalidatePath('/calendar');
  revalidatePath('/m/calendar');
}
