'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import type { AgeGroup } from '@kinderbase/types';

export async function createClassroom(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase.from('classrooms').insert({
    center_id: formData.get('center_id') as string,
    name: formData.get('name') as string,
    age_group: formData.get('age_group') as AgeGroup,
    licensed_capacity: parseInt(formData.get('licensed_capacity') as string),
    typical_enrollment: parseInt(formData.get('typical_enrollment') as string) || 0,
  });

  revalidatePath('/classrooms');
}

export async function updateClassroom(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase.from('classrooms').update({
    name: formData.get('name') as string,
    age_group: formData.get('age_group') as AgeGroup,
    licensed_capacity: parseInt(formData.get('licensed_capacity') as string),
    typical_enrollment: parseInt(formData.get('typical_enrollment') as string) || 0,
  }).eq('id', id);

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

export async function getClassroom(id: string) {
  const supabase = createClient();
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('*, centers(state)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!classroom) return null;

  const { data: patterns } = await supabase
    .from('staffing_patterns')
    .select('*')
    .eq('classroom_id', id);

  const center = Array.isArray(classroom.centers) ? classroom.centers[0] : classroom.centers;

  return {
    classroom: {
      id: classroom.id,
      center_id: classroom.center_id,
      name: classroom.name,
      age_group: classroom.age_group,
      licensed_capacity: classroom.licensed_capacity,
      typical_enrollment: classroom.typical_enrollment,
      created_at: classroom.created_at,
      deleted_at: classroom.deleted_at,
    },
    state: (center as { state: string } | null)?.state ?? 'MD',
    patterns: patterns ?? [],
  };
}
