import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

export type StudentAccess = { service: Service; centerId: string; role: CenterRole; userId: string };

/** Resolve the caller's membership role for a student's center, or null. */
export async function studentContext(childId: string): Promise<StudentAccess | null> {
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

export function isEditor(role: CenterRole): boolean {
  return role === 'director' || role === 'admin';
}

/** Empty/whitespace string → null (for nullable text columns). */
export function orNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}
