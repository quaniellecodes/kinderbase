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

export type DemoPersona = { userId: string; label: string; role: CenterRole; roleLabel: string };

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
      out.push({ userId: pick.userId, label: pick.name.split(' ')[0]!, role, roleLabel: label });
      usedRoles.add(role);
    }
    if (out.length >= 4) break;
  }
  return out;
}
