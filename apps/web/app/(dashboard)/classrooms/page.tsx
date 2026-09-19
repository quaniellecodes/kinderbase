import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { computeRatio } from '@kinderbase/core';
import { getClassrooms } from './actions';
import { ClassroomsClient } from './ClassroomsClient';

async function getCenterState(centerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('centers')
    .select('state')
    .eq('id', centerId)
    .single();
  return data?.state ?? 'MD';
}

export default async function ClassroomsPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const [classrooms, state] = await Promise.all([
    getClassrooms(active.centerId),
    getCenterState(active.centerId),
  ]);

  const classroomsWithRatio = classrooms.map(c => ({
    ...c,
    ratio: computeRatio(c.age_group, c.typical_enrollment, 0, state),
  }));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <ClassroomsClient centerId={active.centerId} classrooms={classroomsWithRatio} />
    </div>
  );
}
