import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { Clock } from '@/lib/clock';
import type { RoomInput, Child, Staff } from '@kinderbase/core';

type Service = ReturnType<typeof createServiceClient>;

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Assemble a `RoomInput` for the engine from live data (docs/sessions/01-ENGINE.md §5):
 * children with an open attendance row, staff with an assignment covering now
 * (minus open breaks), qualifications from center_memberships, latest nap event today.
 */
export async function loadRoomInput(classroomId: string, clock: Clock, db?: Service): Promise<RoomInput | null> {
  const service = db ?? createServiceClient();
  const at = clock.now();
  const nowISO = at.toISOString();
  const today = localDateISO(at);

  const { data: classroom } = await service.from('classrooms').select('id, center_id').eq('id', classroomId).maybeSingle();
  if (!classroom) return null;

  // Children present now: signed in today, not signed out.
  const { data: attendance } = await service
    .from('child_attendance')
    .select('children(id, birthdate)')
    .eq('classroom_id', classroomId)
    .eq('attendance_date', today)
    .not('signed_in_at', 'is', null)
    .is('signed_out_at', null);
  const children: Child[] = (attendance ?? [])
    .map((a) => (Array.isArray(a.children) ? a.children[0] : a.children))
    .filter((c): c is { id: string; birthdate: string } => !!c)
    .map((c) => ({ id: c.id, dob: new Date(`${c.birthdate}T00:00:00`) }));

  // Staff assigned to this room right now.
  const { data: assignments } = await service
    .from('staff_assignments')
    .select('user_id')
    .eq('classroom_id', classroomId)
    .lte('starts_at', nowISO)
    .gt('ends_at', nowISO);
  const assignedIds = [...new Set((assignments ?? []).map((a) => a.user_id))];

  // Remove anyone on an open break in this room.
  const { data: breaks } = assignedIds.length
    ? await service.from('staff_breaks').select('user_id').eq('classroom_id', classroomId).is('ended_at', null).in('user_id', assignedIds)
    : { data: [] as { user_id: string }[] };
  const onBreak = new Set((breaks ?? []).map((b) => b.user_id));
  const presentIds = assignedIds.filter((id) => !onBreak.has(id));

  // Qualifications from center membership.
  const { data: memberships } = presentIds.length
    ? await service
        .from('center_memberships')
        .select('user_id, lead_qualified, infant_toddler_trained')
        .eq('center_id', classroom.center_id)
        .in('user_id', presentIds)
        .is('left_at', null)
    : { data: [] as { user_id: string; lead_qualified: boolean; infant_toddler_trained: boolean }[] };
  const qualByUser = new Map((memberships ?? []).map((m) => [m.user_id, m]));
  const staff: Staff[] = presentIds.map((id) => {
    const q = qualByUser.get(id);
    return { id, leadQualified: q?.lead_qualified ?? false, infantToddlerTrained: q?.infant_toddler_trained ?? false };
  });

  // Latest nap event today → current state (default awake).
  const { data: nap } = await service
    .from('classroom_nap_events')
    .select('state, set_at')
    .eq('classroom_id', classroomId)
    .gte('set_at', `${today}T00:00:00`)
    .order('set_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const napState = (nap?.state ?? 'awake') as RoomInput['napState'];

  return { children, staff, napState, at };
}

/** The classroom whose assignment covers now for this user, or null. */
export async function activeClassroomFor(userId: string, clock: Clock, db?: Service): Promise<string | null> {
  const service = db ?? createServiceClient();
  const nowISO = clock.now().toISOString();
  const { data } = await service
    .from('staff_assignments')
    .select('classroom_id, starts_at')
    .eq('user_id', userId)
    .lte('starts_at', nowISO)
    .gt('ends_at', nowISO)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.classroom_id ?? null;
}
