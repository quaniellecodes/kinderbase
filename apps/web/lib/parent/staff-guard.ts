import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceClient>;

/** Is this user a guardian of this child? (One identity, many memberships — §7b.) */
export async function isGuardianOfChild(service: Service, userId: string, childId: string): Promise<boolean> {
  const { data } = await service.from('guardians').select('id').eq('app_user_id', userId).eq('child_id', childId).limit(1);
  return !!(data && data.length);
}

/**
 * A staff member is never the assessor of record for their own child and may not
 * post observations/assessments about them from the staff context
 * (docs/PARENT-DECISIONS.md §7b). Call before writing an observation, checkpoint
 * rating, screening, or referral. It is what lets a director say, honestly, that
 * assessments are independent of who the child's mother happens to work for.
 */
export async function assertNotOwnChildAssessment(service: Service, userId: string, childId: string): Promise<void> {
  if (await isGuardianOfChild(service, userId, childId)) {
    throw new Error("You can't assess or post about your own child from staff — switch to Family view.");
  }
}

/**
 * Log (never block) a staff-context access to one's own child's record. A teacher
 * can see their own child's room; reaching the record from staff is recorded so an
 * access question later has an answer. The family-facing records belong in the
 * parent context.
 */
export async function logOwnChildAccess(service: Service, userId: string, childId: string, centerId: string): Promise<void> {
  if (await isGuardianOfChild(service, userId, childId)) {
    await service.from('activity_log').insert({ center_id: centerId, actor_id: userId, event_type: 'staff.viewed_own_child', payload: { child_id: childId } });
  }
}
