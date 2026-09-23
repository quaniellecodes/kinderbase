import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { setActiveContext } from '@/lib/session/active-context';
import { isDemo, assertNotProd } from '@/lib/demo';
import { hasValidGate } from '@/lib/demo-gate';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { CenterRole } from '@kinderbase/types';

// One-tap persona sign-in for the demo bar (docs/sessions/06 §3). DEMO_MODE only,
// and behind the same access gate as the rest of /demo — otherwise anyone could
// POST a userId and sign in as any persona (incl. the Director) without the
// passcode.
export async function POST(req: Request) {
  if (!isDemo()) return new NextResponse('Not found', { status: 404 });
  assertNotProd();
  if (!hasValidGate()) return NextResponse.json({ error: 'Gate required' }, { status: 401 });
  if (!rateLimit(`demo-login:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Wait a moment.' }, { status: 429 });
  }

  const { userId, centerId } = (await req.json().catch(() => ({}))) as { userId?: string; centerId?: string };
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const service = createServiceClient();
  const { data: user } = await service.from('users').select('email').eq('id', userId).maybeSingle();
  if (!user?.email) return NextResponse.json({ error: 'Unknown persona' }, { status: 404 });

  const password = process.env.DEMO_USER_PASSWORD ?? 'Sandbox!23456';
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Set the persona's active context (their membership at the current center, else
  // their first) so both /dashboard and /m have a valid context after reload.
  let ctxQuery = service.from('center_memberships').select('center_id, role, centers(name)').eq('user_id', userId).is('left_at', null);
  if (centerId) ctxQuery = ctxQuery.eq('center_id', centerId);
  const { data: m } = await ctxQuery.limit(1).maybeSingle();
  if (m) {
    const center = Array.isArray(m.centers) ? m.centers[0] : m.centers;
    await setActiveContext({ centerId: m.center_id, centerName: (center as { name: string } | null)?.name ?? 'Center', role: m.role as CenterRole });
  }
  return NextResponse.json({ ok: true });
}
