import 'server-only';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceClient>;

/** Cookie holding the guardian's selected child (multi-child switcher). */
export const ACTIVE_CHILD_COOKIE = 'kb_active_child';

export type GuardianPermission = 'pickup' | 'account' | 'edit_record';
const GUARDIAN_PERMISSIONS: readonly GuardianPermission[] = ['pickup', 'account', 'edit_record'];
function isGuardianPermission(p: string): p is GuardianPermission {
  return (GUARDIAN_PERMISSIONS as readonly string[]).includes(p);
}

type ParentBase = {
  service: Service;
  userId: string;
  /** Every child this guardian may reach. Parent queries start here and join outward. */
  childIds: string[];
  /** The selected child (cookie) when valid, else the first — what readers resolve to. */
  activeChildId: string;
  permissionsByChild: Record<string, GuardianPermission[]>;
};
// Discriminated so an emulated principal CANNOT exist without its label — the label
// renders the persistent "you are emulating" bar, so the two must never diverge.
export type ParentPrincipal = ParentBase &
  ({ emulated: false } | { emulated: true; emulatedLabel: string });

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

  // Effective principal: an open emulation session makes this resolve to the
  // emulated family instead of the viewer's own — read-only (emulated: true).
  const { data: emu, error: emuErr } = await service
    .from('emulation_sessions')
    .select('child_id, guardian_id, is_sample')
    .eq('viewer_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  // Fail closed: if we can't tell whether an emulation is active, deny rather than
  // fall through to the viewer's OWN family (which would silently drop read-only).
  if (emuErr) return null;
  if (emu) {
    const { data: child } = await service.from('children').select('first_name, preferred_name, last_name').eq('id', emu.child_id).maybeSingle();
    const first = child ? child.preferred_name ?? child.first_name : 'child';
    let label = emu.is_sample ? 'Sample family' : `${first}'s family`;
    if (!emu.is_sample && emu.guardian_id) {
      const { data: g } = await service.from('guardians').select('full_name').eq('id', emu.guardian_id).maybeSingle();
      if (g?.full_name) label = `${g.full_name} · ${first}`;
    }
    return { service, userId: user.id, childIds: [emu.child_id], activeChildId: emu.child_id, permissionsByChild: { [emu.child_id]: ['account'] }, emulated: true, emulatedLabel: label };
  }

  const { data: rows } = await service.from('guardians').select('child_id, permissions').eq('app_user_id', user.id);
  if (!rows || rows.length === 0) return null;
  const permissionsByChild: Record<string, GuardianPermission[]> = {};
  // Validate at the boundary rather than `as`-casting the DB's string[] into the
  // union — an unknown value (typo, renamed/removed permission) is dropped here
  // instead of laundering through the type system.
  for (const r of rows) permissionsByChild[r.child_id] = (r.permissions ?? []).filter(isGuardianPermission);
  const childIds = Object.keys(permissionsByChild);
  // The switcher's selected child, if it's still one this guardian may reach.
  const selected = cookies().get(ACTIVE_CHILD_COOKIE)?.value;
  const activeChildId = selected && childIds.includes(selected) ? selected : childIds[0]!;
  return { service, userId: user.id, childIds, activeChildId, permissionsByChild, emulated: false };
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
