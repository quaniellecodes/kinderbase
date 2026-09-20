'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { CenterRole } from '@kinderbase/types';
import type { Database } from '@kinderbase/types/database';

type Service = ReturnType<typeof createServiceClient>;

async function studentContext(
  childId: string,
): Promise<{ service: Service; centerId: string; role: CenterRole } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: child } = await service
    .from('children')
    .select('center_id')
    .eq('id', childId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!child) return null;
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', child.center_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null;
  return { service, centerId: child.center_id, role: m.role as CenterRole };
}

function isEditor(role: CenterRole): boolean {
  return role === 'director' || role === 'admin';
}

// ── About ─────────────────────────────────────────────────────────────────
export type StudentAbout = {
  canEdit: boolean;
  selections: Record<string, string[]>;
  note: string;
  options: Record<string, string[]>; // descriptor labels available per group
};

export async function getStudentAbout(childId: string): Promise<StudentAbout | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, centerId, role } = ctx;

  const { data: about } = await service
    .from('student_about')
    .select('selections, note')
    .eq('child_id', childId)
    .maybeSingle();

  const { data: descriptors } = await service
    .from('student_descriptors')
    .select('group_key, label, center_id')
    .or(`center_id.is.null,center_id.eq.${centerId}`)
    .order('label');

  const options: Record<string, string[]> = {};
  for (const d of descriptors ?? []) {
    (options[d.group_key] ??= []).push(d.label);
  }

  const rawSelections = (about?.selections ?? {}) as Record<string, unknown>;
  const selections: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(rawSelections)) {
    if (Array.isArray(v)) selections[k] = v.filter((x): x is string => typeof x === 'string');
  }

  return { canEdit: isEditor(role), selections, note: about?.note ?? '', options };
}

export async function saveStudentAbout(
  childId: string,
  input: { selections: Record<string, string[]>; note: string },
): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, centerId } = ctx;

  // Persist any newly-typed labels as reusable center-scoped descriptors.
  const { data: existing } = await service
    .from('student_descriptors')
    .select('group_key, label')
    .or(`center_id.is.null,center_id.eq.${centerId}`);
  const known = new Set((existing ?? []).map((d) => `${d.group_key}::${d.label}`));
  const newDescriptors: Database['public']['Tables']['student_descriptors']['Insert'][] = [];
  for (const [group, labels] of Object.entries(input.selections)) {
    for (const label of labels) {
      const key = `${group}::${label}`;
      if (!known.has(key)) {
        known.add(key);
        newDescriptors.push({ center_id: centerId, group_key: group, label });
      }
    }
  }
  if (newDescriptors.length) {
    await service.from('student_descriptors').upsert(newDescriptors, { onConflict: 'center_id,group_key,label', ignoreDuplicates: true });
  }

  const { error } = await service.from('student_about').upsert(
    {
      child_id: childId,
      selections: input.selections as Database['public']['Tables']['student_about']['Insert']['selections'],
      note: input.note.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'child_id' },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

// ── Schedule ──────────────────────────────────────────────────────────────
export type StudentSchedule = {
  canEdit: boolean;
  days: number[];
  dropoffWindow: string;
  pickupWindow: string;
  transitionRoom: string;
  transitionDate: string;
  rooms: string[];
};

export async function getStudentSchedule(childId: string): Promise<StudentSchedule | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, centerId, role } = ctx;

  const { data: sched } = await service
    .from('student_schedule')
    .select('days, dropoff_window, pickup_window, transition_room, transition_date')
    .eq('child_id', childId)
    .maybeSingle();

  const { data: rooms } = await service
    .from('classrooms')
    .select('name')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');

  const daysJson = (sched?.days ?? {}) as { days?: unknown };
  const days = Array.isArray(daysJson.days)
    ? daysJson.days.filter((d): d is number => typeof d === 'number')
    : [];

  return {
    canEdit: isEditor(role),
    days,
    dropoffWindow: sched?.dropoff_window ?? '',
    pickupWindow: sched?.pickup_window ?? '',
    transitionRoom: sched?.transition_room ?? '',
    transitionDate: sched?.transition_date ?? '',
    rooms: (rooms ?? []).map((r) => r.name),
  };
}

export async function saveStudentSchedule(
  childId: string,
  input: { days: number[]; dropoffWindow: string; pickupWindow: string; transitionRoom: string; transitionDate: string },
): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;

  const { error } = await service.from('student_schedule').upsert(
    {
      child_id: childId,
      days: { days: [...input.days].sort((a, b) => a - b) } as Database['public']['Tables']['student_schedule']['Insert']['days'],
      dropoff_window: input.dropoffWindow.trim() || null,
      pickup_window: input.pickupWindow.trim() || null,
      transition_room: input.transitionRoom.trim() || null,
      transition_date: input.transitionDate || null,
    },
    { onConflict: 'child_id' },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}
