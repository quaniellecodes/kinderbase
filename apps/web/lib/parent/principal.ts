import 'server-only';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceClient>;

export type GuardianPermission = 'pickup' | 'account' | 'edit_record';

export type ParentPrincipal = {
  service: Service;
  userId: string;
  /** Every child this guardian may reach. Parent queries start here and join outward. */
  childIds: string[];
  permissionsByChild: Record<string, GuardianPermission[]>;
  /** Set when a director is emulating this guardian (Phase 6): all writes refused. */
  emulated: boolean;
};

/**
 * The parent principal (docs/PARENT-DECISIONS.md §1): deny by default. Resolve the
 * viewer's reachable children from guardian memberships — a parent-facing query
 * NEVER starts from a classroom or a center. Returns null for a non-guardian.
 *
 * Phase 6 makes this effective-principal aware: an open emulation session resolves
 * to the emulated guardian's children with `emulated: true` (read-only).
 */
export async function parentContext(): Promise<ParentPrincipal | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: rows } = await service.from('guardians').select('child_id, permissions').eq('app_user_id', user.id);
  if (!rows || rows.length === 0) return null;
  const permissionsByChild: Record<string, GuardianPermission[]> = {};
  for (const r of rows) permissionsByChild[r.child_id] = (r.permissions ?? []) as GuardianPermission[];
  return { service, userId: user.id, childIds: Object.keys(permissionsByChild), permissionsByChild, emulated: false };
}

/**
 * Assert a child is reachable by this principal, else throw. Uses "Not found"
 * rather than "Forbidden" so a guessed id never confirms another child exists.
 */
export function assertReachable(p: ParentPrincipal, childId: string): void {
  if (!p.childIds.includes(childId)) throw new Error('Not found');
}

export function hasPermission(p: ParentPrincipal, childId: string, perm: GuardianPermission): boolean {
  return (p.permissionsByChild[childId] ?? []).includes(perm);
}

/** Refuse any write while emulating a family (centralized guard — Phase 6). */
export function assertCanWrite(p: ParentPrincipal): void {
  if (p.emulated) throw new Error('Emulation is read-only');
}
