import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isDemo, assertNotProd, getDemoPersonas } from '@/lib/demo';
import { DemoBar } from './DemoBar';

/** Server wrapper — resolves personas/clock/context and renders the DemoBar (DEMO_MODE only). */
export async function DemoBarMount({ surface }: { surface: 'desktop' | 'mobile' }) {
  if (!isDemo()) return null;
  assertNotProd(); // loud crash if DEMO_MODE is ever pointed at production
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const active = getActiveContextFromCookies();
  if (!user || !active) return null;

  const personas = await getDemoPersonas(active.centerId);
  const now = getClock().now();
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overrideActive = !!cookies().get('kb_demo_now')?.value;

  return (
    <DemoBar
      personas={personas}
      currentUserId={user.id}
      centerId={active.centerId}
      nowHHmm={nowHHmm}
      overrideActive={overrideActive}
      surface={surface}
    />
  );
}
