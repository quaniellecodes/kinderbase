import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { token, platform } = await request.json() as { token: string; platform: string };
  if (!token || !platform) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform },
    { onConflict: 'user_id,token' }
  );

  return NextResponse.json({ ok: true });
}
