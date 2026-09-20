'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { ageInMonths, isAdmin, type CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function requireAdminCenter(): Promise<{ service: Service; centerId: string; userId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  // Re-verify the caller is an active admin/director of the active center.
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', active.centerId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m || !isAdmin(m.role as CenterRole)) return null;
  return { service, centerId: active.centerId, userId: user.id };
}

export type NewStudentOptions = { classrooms: { value: string; label: string }[]; languageOptions: string[]; tagOptions: string[] };

export async function getNewStudentOptions(): Promise<NewStudentOptions> {
  const ctx = await requireAdminCenter();
  if (!ctx) return { classrooms: [], languageOptions: ['English', 'Spanish'], tagOptions: [] };
  const { service, centerId } = ctx;
  const { data: rooms } = await service
    .from('classrooms')
    .select('id, name')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');
  const { data: kids } = await service.from('children').select('home_languages, tags').eq('center_id', centerId).is('deleted_at', null);
  const langs = new Set<string>(['English', 'Spanish']);
  const tags = new Set<string>();
  for (const k of kids ?? []) {
    for (const l of k.home_languages ?? []) langs.add(l);
    for (const t of k.tags ?? []) tags.add(t);
  }
  return {
    classrooms: [{ value: '', label: 'Unassigned' }, ...(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))],
    languageOptions: [...langs].sort(),
    tagOptions: [...tags].sort(),
  };
}

export type NewStudentInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  birthdate: string;
  sex: string;
  classroomId: string;
  enrollmentStatus: 'active' | 'inactive' | 'waitlist' | 'graduated';
  primaryLanguage: string;
  homeLanguages: string[];
  tags: string[];
  guardian: { fullName: string; relationship: string; mobilePhone: string; email: string; isEmergency: boolean };
};

function studentCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `KB-${s}`;
}

export async function createStudent(input: NewStudentInput): Promise<{ childId: string }> {
  const ctx = await requireAdminCenter();
  if (!ctx) throw new Error('Forbidden');
  const { service, centerId } = ctx;

  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error('First and last name are required');
  if (!input.birthdate) throw new Error('Date of birth is required');

  const today = new Date().toISOString().slice(0, 10);

  const { data: child, error } = await service
    .from('children')
    .insert({
      center_id: centerId,
      classroom_id: input.classroomId || null,
      first_name: input.firstName.trim(),
      middle_name: input.middleName.trim() || null,
      last_name: input.lastName.trim(),
      preferred_name: input.preferredName.trim() || null,
      birthdate: input.birthdate,
      sex: input.sex || null,
      enrollment_status: input.enrollmentStatus,
      primary_language: input.primaryLanguage.trim() || null,
      home_languages: input.homeLanguages,
      tags: input.tags,
      status: 'enrolled',
      enrolled_at: today,
      student_code: studentCode(),
      photo_consent: false,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const childId = child.id;

  if (input.guardian.fullName.trim()) {
    await service.from('guardians').insert({
      child_id: childId,
      full_name: input.guardian.fullName.trim(),
      relationship: (['mother', 'father', 'grandparent', 'guardian', 'other'].includes(input.guardian.relationship) ? input.guardian.relationship : 'guardian') as 'mother' | 'father' | 'grandparent' | 'guardian' | 'other',
      mobile_phone: input.guardian.mobilePhone.trim() || null,
      email: input.guardian.email.trim() || null,
      is_primary: true,
      is_emergency: input.guardian.isEmergency,
      is_pickup_restricted: false,
      sort_order: 0,
    });
  }

  // Seed the About + Schedule shells so those cards render immediately.
  await service.from('student_about').insert({ child_id: childId, selections: {} });
  await service.from('student_schedule').insert({ child_id: childId, days: { days: [1, 2, 3, 4, 5] } });

  // Create a current-period checkpoint when an ELOF view is available for the age.
  const view = ageInMonths(input.birthdate) < 36 ? 'infant_toddler' : 'preschool';
  const { data: fw } = await service
    .from('frameworks')
    .select('id')
    .eq('is_system', true)
    .is('center_id', null)
    .eq('name', 'Head Start Early Learning Outcomes Framework')
    .maybeSingle();
  if (fw) {
    const { count } = await service
      .from('framework_domains')
      .select('id', { count: 'exact', head: true })
      .eq('framework_id', fw.id)
      .eq('view', view);
    if ((count ?? 0) > 0) {
      const end = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
      await service.from('checkpoints').insert({
        child_id: childId,
        center_id: centerId,
        framework_id: fw.id,
        view,
        period_label: `Intake ${today.slice(0, 7)}`,
        period_start: today,
        period_end: end,
        status: 'draft',
      });
    }
  }

  revalidatePath('/students');
  return { childId };
}
