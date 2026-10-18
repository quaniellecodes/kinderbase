import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isDemo, assertNotProd, getDemoPersonas } from '@/lib/demo';
import { hasValidGate } from '@/lib/demo-gate';
import { DemoGate } from './DemoGate';
import { DemoStage } from './DemoStage';

export const dynamic = 'force-dynamic';

// Partner-facing phone/tablet simulator: /m in a device frame behind a passcode
// gate (docs/sessions/06 §4, §6).
export default async function DemoPage({ searchParams }: { searchParams: { invite?: string } }) {
  if (!isDemo()) notFound();
  assertNotProd();

  // Gate first — the gate route also signs the viewer in as the default persona.
  if (!hasValidGate()) return <DemoGate invite={searchParams.invite} />;

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return <DemoGate invite={searchParams.invite} />;

  // The demo center: a staff persona has an active context; a PARENT persona (a
  // guardian) has none, so derive the center from their child.
  const active = getActiveContextFromCookies();
  const service = createServiceClient();
  let centerId = active?.centerId ?? null;
  if (!centerId) {
    const { data: g } = await service.from('guardians').select('children(center_id)').eq('app_user_id', user.id).limit(1).maybeSingle();
    const ch = g ? (Array.isArray(g.children) ? g.children[0] : g.children) : null;
    centerId = (ch as { center_id: string } | null)?.center_id ?? null;
  }
  if (!centerId) return <DemoGate invite={searchParams.invite} />;

  const personas = await getDemoPersonas(centerId);
  const now = getClock().now();
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overrideActive = !!cookies().get('kb_demo_now')?.value;

  return <DemoStage personas={personas} currentUserId={user.id} centerId={centerId} nowHHmm={nowHHmm} overrideActive={overrideActive} />;
}
