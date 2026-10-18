import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';

// Switch between staff and parent contexts (PARENT-DECISIONS §7b). One account,
// many memberships; the switcher moves CONTEXTS. Every switch is audited (so an
// access question months later has an answer), then redirects to the right app.
// The parent app never carries staff context; this only grants a parent context
// to a person who is actually a guardian.
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to');
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));
  const service = createServiceClient();

  if (to === 'parent') {
    const { data: g } = await service.from('guardians').select('children(center_id)').eq('app_user_id', user.id).limit(1).maybeSingle();
    if (!g) return NextResponse.redirect(new URL('/dashboard', req.url)); // not a guardian
    const center = Array.isArray(g.children) ? g.children[0] : g.children;
    const centerId = (center as { center_id: string } | null)?.center_id;
    if (centerId) await service.from('activity_log').insert({ center_id: centerId, actor_id: user.id, event_type: 'context.switched', payload: { to: 'parent' } });
    return NextResponse.redirect(new URL('/p', req.url));
  }

  // → staff
  const active = getActiveContextFromCookies();
  if (active) await service.from('activity_log').insert({ center_id: active.centerId, actor_id: user.id, event_type: 'context.switched', payload: { to: 'staff' } });
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
