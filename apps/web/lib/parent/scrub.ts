import 'server-only';
import type { createServiceClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceClient>;

/**
 * The names to scrub from a child's free-text content before it leaves the server:
 * the OTHER children in their room (a teacher's note can name a classmate, and RLS
 * can't rewrite text — docs/PARENT-DECISIONS.md §1). Assembled here and passed to
 * redactNames (packages/core/parent-scrub.ts) by each parent reader.
 */
export async function roomOtherNames(svc: Service, childId: string, classroomId: string | null): Promise<string[]> {
  if (!classroomId) return [];
  const { data: roommates } = await svc.from('children').select('first_name, preferred_name').eq('classroom_id', classroomId).neq('id', childId);
  return (roommates ?? []).flatMap((r) => [r.first_name, r.preferred_name]).filter((n): n is string => !!n);
}
