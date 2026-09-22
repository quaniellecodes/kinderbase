import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { setActiveContext } from '@/lib/session/active-context';
import { isDemo, assertNotProd } from '@/lib/demo';
import { checkPasscode, checkInvite, setGateCookie } from '@/lib/demo-gate';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { CenterRole } from '@kinderbase/types';

// Access gate for /demo (docs/sessions/06 §6). Accepts a passcode or a signed
// invite token, sets the 7-day gate cookie, and — if the viewer has no session
// yet — signs them in as the default persona so the phone works immediately.
export async function POST(req: Request) {
  if (!isDemo()) return new NextResponse('Not found', { status: 404 });
  assertNotProd();

  if (!rateLimit(`demo-gate:${clientIp(req)}`, 8, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  }

  const { passcode, invite } = (await req.json().catch(() => ({}))) as { passcode?: string; invite?: string };
  const ok = (invite && checkInvite(invite)) || (passcode && checkPasscode(passcode));
  if (!ok) return NextResponse.json({ error: 'That passcode isn’t right.' }, { status: 401 });

  setGateCookie();

  // If not already signed in as a demo persona, land on the Director for the
  // richest first view (admin Home + Inbox).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
        const { error } = await supabase.auth.signInWithPassword({ email: u.email, password });
        if (!error) await setActiveContext({ centerId: center.id, centerName: center.name, role: m!.role as CenterRole });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
