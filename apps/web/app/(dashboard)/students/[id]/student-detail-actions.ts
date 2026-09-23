'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { childDisplayName, type CenterRole } from '@kinderbase/types';
import type { Database } from '@kinderbase/types/database';

type Service = ReturnType<typeof createServiceClient>;

// ── auth: resolve the caller's role for a student's center ───────────────────
async function studentContext(
  childId: string,
): Promise<{ service: Service; centerId: string; role: CenterRole; userId: string } | null> {
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
  return { service, centerId: child.center_id, role: m.role as CenterRole, userId: user.id };
}

function isEditor(role: CenterRole): boolean {
  return role === 'director' || role === 'admin';
}

/** Empty string → null (for nullable text columns). */
function orNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// ── Info tab ─────────────────────────────────────────────────────────────────
export type StudentInfoValues = {
  preferred_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  birthdate: string;
  sex: string;
  enrollment_status: string;
  classroom_id: string;
  primary_language: string;
  home_languages: string[];
  tags: string[];
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  photo_consent: boolean;
  admin_notes: string;
};

export type StudentInfo = {
  canEdit: boolean;
  studentCode: string | null;
  classrooms: { value: string; label: string }[];
  languageOptions: string[];
  tagOptions: string[];
  values: StudentInfoValues;
};

export async function getStudentInfo(childId: string): Promise<StudentInfo | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, centerId, role } = ctx;

  const { data: c } = await service
    .from('children')
    .select(
      'preferred_name, first_name, middle_name, last_name, birthdate, sex, enrollment_status, classroom_id, primary_language, home_languages, tags, address_line1, address_line2, city, state, zip, photo_consent, admin_notes, student_code',
    )
    .eq('id', childId)
    .single();
  if (!c) return null;

  const { data: rooms } = await service
    .from('classrooms')
    .select('id, name')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');

  // Suggestion pools for the multiselects: distinct languages/tags already in use.
  const { data: siblings } = await service
    .from('children')
    .select('home_languages, tags')
    .eq('center_id', centerId)
    .is('deleted_at', null);
  const langSet = new Set<string>(['English', 'Spanish']);
  const tagSet = new Set<string>();
  for (const s of siblings ?? []) {
    for (const l of s.home_languages ?? []) langSet.add(l);
    for (const t of s.tags ?? []) tagSet.add(t);
  }

  return {
    canEdit: isEditor(role),
    studentCode: c.student_code,
    classrooms: [{ value: '', label: 'Unassigned' }, ...(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))],
    languageOptions: [...langSet].sort(),
    tagOptions: [...tagSet].sort(),
    values: {
      preferred_name: c.preferred_name ?? '',
      first_name: c.first_name ?? '',
      middle_name: c.middle_name ?? '',
      last_name: c.last_name ?? '',
      birthdate: c.birthdate ?? '',
      sex: c.sex ?? '',
      enrollment_status: c.enrollment_status,
      classroom_id: c.classroom_id ?? '',
      primary_language: c.primary_language ?? '',
      home_languages: c.home_languages ?? [],
      tags: c.tags ?? [],
      address_line1: c.address_line1 ?? '',
      address_line2: c.address_line2 ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      zip: c.zip ?? '',
      photo_consent: c.photo_consent,
      admin_notes: c.admin_notes ?? '',
    },
  };
}

const TEXT_FIELDS = new Set([
  'preferred_name',
  'first_name',
  'middle_name',
  'last_name',
  'sex',
  'primary_language',
  'address_line1',
  'address_line2',
  'city',
  'zip',
  'admin_notes',
]);

export async function updateStudentInfo(childId: string, patch: Partial<StudentInfoValues>): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (TEXT_FIELDS.has(key)) update[key] = orNull(value);
    else if (key === 'first_name' || key === 'last_name') update[key] = (value as string)?.trim() || null;
    else if (key === 'birthdate') update[key] = orNull(value);
    else if (key === 'classroom_id') update[key] = value === '' ? null : value;
    else if (key === 'state') update[key] = value ? String(value).toUpperCase().slice(0, 2) : null;
    else if (key === 'enrollment_status') update[key] = value;
    else if (key === 'photo_consent') update[key] = !!value;
    else if (key === 'home_languages' || key === 'tags') update[key] = Array.isArray(value) ? value : [];
  }
  // first_name/last_name are NOT NULL — never allow clearing to null.
  if ('first_name' in update && !update.first_name) delete update.first_name;
  if ('last_name' in update && !update.last_name) delete update.last_name;
  if (Object.keys(update).length === 0) return;

  const { error } = await service
    .from('children')
    .update(update as unknown as Database['public']['Tables']['children']['Update'])
    .eq('id', childId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
  revalidatePath('/students');
}

// ── Family tab ────────────────────────────────────────────────────────────────
export type GuardianRow = {
  id: string;
  full_name: string;
  relationship: string;
  email: string;
  mobile_phone: string;
  employer: string;
  work_phone: string;
  is_primary: boolean;
  is_emergency: boolean;
  is_pickup_restricted: boolean;
  custody_note: string;
};
export type PickupRow = { id: string; full_name: string; relationship: string; phone: string };
export type SiblingRow = { id: string; name: string };

export type StudentFamily = {
  canEdit: boolean;
  guardians: GuardianRow[];
  pickups: PickupRow[];
  siblings: SiblingRow[];
};

export async function getStudentFamily(childId: string): Promise<StudentFamily | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;

  const { data: guardians } = await service
    .from('guardians')
    .select('id, full_name, relationship, email, mobile_phone, employer, work_phone, is_primary, is_emergency, is_pickup_restricted, custody_note')
    .eq('child_id', childId)
    .order('sort_order');

  const { data: pickups } = await service
    .from('authorized_pickups')
    .select('id, full_name, relationship, phone')
    .eq('child_id', childId)
    .order('created_at');

  const { data: sibs } = await service
    .from('student_siblings')
    .select('sibling_id, children!student_siblings_sibling_id_fkey(id, first_name, last_name)')
    .eq('child_id', childId);

  return {
    canEdit: isEditor(role),
    guardians: (guardians ?? []).map((g) => ({
      id: g.id,
      full_name: g.full_name ?? '',
      relationship: g.relationship,
      email: g.email ?? '',
      mobile_phone: g.mobile_phone ?? '',
      employer: g.employer ?? '',
      work_phone: g.work_phone ?? '',
      is_primary: g.is_primary,
      is_emergency: g.is_emergency,
      is_pickup_restricted: g.is_pickup_restricted,
      custody_note: g.custody_note ?? '',
    })),
    pickups: (pickups ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? '',
      relationship: p.relationship ?? '',
      phone: p.phone ?? '',
    })),
    siblings: (sibs ?? [])
      .map((s) => {
        const child = Array.isArray(s.children) ? s.children[0] : s.children;
        return child ? { id: child.id, name: childDisplayName(child) } : null;
      })
      .filter((x): x is SiblingRow => !!x),
  };
}

const GUARDIAN_TEXT = new Set(['email', 'mobile_phone', 'employer', 'work_phone', 'custody_note']);
const GUARDIAN_BOOL = new Set(['is_primary', 'is_emergency', 'is_pickup_restricted']);

export async function saveFamily(
  childId: string,
  patch: { guardians?: Record<string, Partial<GuardianRow>>; pickups?: Record<string, Partial<PickupRow>> },
): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;

  // Guardians — only rows that actually belong to this child.
  const guardianIds = Object.keys(patch.guardians ?? {});
  if (guardianIds.length) {
    const { data: owned } = await service.from('guardians').select('id').eq('child_id', childId).in('id', guardianIds);
    const ownedSet = new Set((owned ?? []).map((r) => r.id));
    for (const id of guardianIds) {
      if (!ownedSet.has(id)) continue;
      const fields = patch.guardians![id]!;
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'full_name') update[k] = (v as string)?.trim() || 'Guardian';
        else if (k === 'relationship') update[k] = v;
        else if (GUARDIAN_TEXT.has(k)) update[k] = orNull(v);
        else if (GUARDIAN_BOOL.has(k)) update[k] = !!v;
      }
      if (Object.keys(update).length)
        await service.from('guardians').update(update as unknown as Database['public']['Tables']['guardians']['Update']).eq('id', id);
    }
  }

  // Pickups.
  const pickupIds = Object.keys(patch.pickups ?? {});
  if (pickupIds.length) {
    const { data: owned } = await service.from('authorized_pickups').select('id').eq('child_id', childId).in('id', pickupIds);
    const ownedSet = new Set((owned ?? []).map((r) => r.id));
    for (const id of pickupIds) {
      if (!ownedSet.has(id)) continue;
      const fields = patch.pickups![id]!;
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'full_name') update[k] = (v as string)?.trim() || 'Pickup';
        else if (k === 'relationship' || k === 'phone') update[k] = orNull(v);
      }
      if (Object.keys(update).length)
        await service.from('authorized_pickups').update(update as unknown as Database['public']['Tables']['authorized_pickups']['Update']).eq('id', id);
    }
  }

  revalidatePath(`/students/${childId}`);
}

export async function addGuardian(childId: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;
  const { count } = await service.from('guardians').select('id', { count: 'exact', head: true }).eq('child_id', childId);
  const { error } = await service
    .from('guardians')
    .insert({ child_id: childId, full_name: 'New guardian', relationship: 'guardian', sort_order: count ?? 0 });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function deleteGuardian(childId: string, guardianId: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  await ctx.service.from('guardians').delete().eq('id', guardianId).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}

export async function addPickup(childId: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service
    .from('authorized_pickups')
    .insert({ child_id: childId, full_name: 'New pickup' });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function deletePickup(childId: string, pickupId: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  await ctx.service.from('authorized_pickups').delete().eq('id', pickupId).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}
