import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
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
  const active = getActiveContextFromCookies();
  // Gated but no session yet (e.g. gate cookie present from a prior visit): show
  // the gate so its route can re-establish the persona session.
  if (!user || !active) return <DemoGate invite={searchParams.invite} />;

  const personas = await getDemoPersonas(active.centerId);
  const now = getClock().now();
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overrideActive = !!cookies().get('kb_demo_now')?.value;

  return <DemoStage personas={personas} currentUserId={user.id} centerId={active.centerId} nowHHmm={nowHHmm} overrideActive={overrideActive} />;
}
