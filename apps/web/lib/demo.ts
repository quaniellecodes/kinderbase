import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { CenterRole } from '@kinderbase/types';

const PROD_REF = 'jqbvojjgkkhbndsgbsuo';

export function isDemo(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/** Crash if DEMO_MODE is on but we're pointed at production (docs/sessions/06 §1). */
export function assertNotProd(): void {
  if (isDemo() && (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_REF)) {
    throw new Error('DEMO_MODE is enabled against the PRODUCTION Supabase project — refusing to start.');
  }
}

export type DemoPersona = { userId: string; label: string; role: CenterRole | 'guardian'; roleLabel: string; kind: 'staff' | 'parent' };

const ROLE_ORDER: { role: CenterRole; label: string }[] = [
  { role: 'director', label: 'Director' },
  { role: 'lead_teacher', label: 'Lead' },
  { role: 'assistant_teacher', label: 'Assistant' },
  { role: 'substitute', label: 'Float' },
  { role: 'aide', label: 'Aide' },
];

/**
 * Representative seeded users for the demo persona switcher — one per role that
 * exists at the center (Director, a Lead, an Assistant, a Float/substitute).
 * Uses first names as chip labels, mirroring the prototype's persona cards.
 */
export async function getDemoPersonas(centerId: string): Promise<DemoPersona[]> {
  if (!isDemo()) return [];
  const service = createServiceClient();
  const { data } = await service
    .from('center_memberships')
    .select('user_id, role, users(full_name)')
    .eq('center_id', centerId)
    .is('left_at', null);
  const rows = (data ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return { userId: m.user_id, role: m.role as CenterRole, name: u?.full_name ?? 'User' };
  });
  const out: DemoPersona[] = [];
  const usedRoles = new Set<CenterRole>();
  for (const { role, label } of ROLE_ORDER) {
    if (usedRoles.has(role)) continue;
    const pick = rows.find((r) => r.role === role);
    if (pick) {
      out.push({ userId: pick.userId, label: pick.name.split(' ')[0]!, role, roleLabel: label, kind: 'staff' });
      usedRoles.add(role);
    }
    if (out.length >= 4) break;
  }

  // A parent persona — a seeded guardian (family view, /p). Prefer a pure parent
  // (family.*) over a teacher-parent so the family app, not staff, is shown.
  const { data: gr } = await service
    .from('guardians')
    .select('app_user_id, users(email), children(center_id, first_name, preferred_name)')
    .not('app_user_id', 'is', null);
  type GRow = { app_user_id: string; users: { email: string } | { email: string }[] | null; children: { center_id: string; first_name: string; preferred_name: string | null } | { center_id: string; first_name: string; preferred_name: string | null }[] | null };
  const cands = ((gr ?? []) as GRow[])
    .map((g) => {
      const u = Array.isArray(g.users) ? g.users[0] : g.users;
      const c = Array.isArray(g.children) ? g.children[0] : g.children;
      return { userId: g.app_user_id, email: u?.email ?? '', child: c };
    })
    .filter((x) => x.child && x.child.center_id === centerId);
  const parent = cands.find((x) => x.email.startsWith('family.')) ?? cands[0];
  if (parent && parent.child) {
    out.push({ userId: parent.userId, label: (parent.child.preferred_name ?? parent.child.first_name).split(' ')[0]!, role: 'guardian', roleLabel: 'Parent', kind: 'parent' });
  }
  return out;
}
