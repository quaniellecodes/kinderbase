import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { setActiveContext } from '@/lib/session/active-context';
import { isDemo, assertNotProd } from '@/lib/demo';
import { hasValidGate } from '@/lib/demo-gate';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { CenterRole } from '@kinderbase/types';

/**
 * Reset the demo *view* to the baseline (docs/sessions/06 §4): clock back to
 * 9:12 and the Director persona — Story 1's starting point. Data is reseeded by
 * the nightly CI job (§7), not here; a route handler can't safely run the full
 * seed script.
 */
export async function POST(req: Request) {
  if (!isDemo()) return new NextResponse('Not found', { status: 404 });
  assertNotProd();
  if (!hasValidGate()) return NextResponse.json({ error: 'Gate required' }, { status: 401 });
  if (!rateLimit(`demo-reset:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many resets. Wait a moment.' }, { status: 429 });
  }

  // Clock → 9:12 today.
  const d = new Date();
  d.setHours(9, 12, 0, 0);
  cookies().set('kb_demo_now', d.toISOString(), { path: '/', maxAge: 86400 });

  // Persona → Director at the first center.
  const service = createServiceClient();
  const { data: center } = await service.from('centers').select('id, name').order('created_at').limit(1).maybeSingle();
  if (center) {
    const { data: m } = await service
      .from('center_memberships')
      .select('user_id, role, users(email)')
      .eq('center_id', center.id)
      .eq('role', 'director')
      .is('left_at', null)
      .limit(1)
      .maybeSingle();
    const u = m ? (Array.isArray(m.users) ? m.users[0] : m.users) : null;
    if (u?.email) {
      const password = process.env.DEMO_USER_PASSWORD ?? 'Sandbox!23456';
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: u.email, password });
      if (!error) await setActiveContext({ centerId: center.id, centerName: center.name, role: m!.role as CenterRole });
    }
  }
  return NextResponse.json({ ok: true });
}
