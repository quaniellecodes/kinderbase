import { createClient } from './supabase/server';

export type ActivityEventType =
  | 'staff.clocked_in'
  | 'staff.clocked_out'
  | 'credential.uploaded'
  | 'classroom.created'
  | 'staff.joined';

export async function logActivity(
  centerId: string,
  eventType: ActivityEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('activity_log').insert({
    center_id: centerId,
    actor_id: user.id,
    event_type: eventType,
    payload,
  });
}
