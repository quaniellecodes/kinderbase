import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isDemo, assertNotProd, getDemoPersonas } from '@/lib/demo';
import { DemoStage } from './DemoStage';

export const dynamic = 'force-dynamic';

// Lightweight phone/tablet simulator: /m in a device frame (docs/sessions/06 §4).
export default async function DemoPage() {
  if (!isDemo()) notFound();
  assertNotProd();

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const personas = await getDemoPersonas(active.centerId);
  const now = getClock().now();
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overrideActive = !!cookies().get('kb_demo_now')?.value;

  return <DemoStage personas={personas} currentUserId={user.id} centerId={active.centerId} nowHHmm={nowHHmm} overrideActive={overrideActive} />;
}
