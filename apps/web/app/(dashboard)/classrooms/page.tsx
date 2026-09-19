import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { computeRatio } from '@kinderbase/core';
import { isAdmin } from '@kinderbase/types';
import { getClassrooms } from './actions';
import { ClassroomsClient } from './ClassroomsClient';

async function getCenterInfo(centerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('centers')
    .select('state, open_slot, close_slot, operating_days')
    .eq('id', centerId)
    .single();
  return {
    state: data?.state ?? 'MD',
    centerHours: {
      openSlot: data?.open_slot ?? 12,
      closeSlot: data?.close_slot ?? 38,
      operatingDays: data?.operating_days ?? [1, 2, 3, 4, 5],
    },
  };
}

export default async function ClassroomsPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const [classrooms, info] = await Promise.all([
    getClassrooms(active.centerId),
    getCenterInfo(active.centerId),
  ]);

  const classroomsWithRatio = classrooms.map(c => ({
    ...c,
    ratio: computeRatio(c.age_group, c.typical_enrollment, 0, info.state),
  }));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <ClassroomsClient
        centerId={active.centerId}
        classrooms={classroomsWithRatio}
        centerHours={info.centerHours}
        canManageHours={isAdmin(active.role)}
      />
    </div>
  );
}
