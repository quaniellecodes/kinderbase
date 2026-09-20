import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getCredentialSignedUrl } from '@/lib/storage/credentials';

// Streams a credential file via a short-lived signed URL. Authorized for the
// credential's owner, or an admin of a center the owner belongs to. Raw storage
// paths are never exposed to the client.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const service = createServiceClient();
  const { data: cred } = await service
    .from('credentials')
    .select('user_id, storage_path')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let allowed = cred.user_id === user.id;
  if (!allowed) {
    const active = getActiveContextFromCookies();
    if (active && isAdmin(active.role)) {
      // The owner must be a member of the admin's active center.
      const { data: shared } = await service
        .from('center_memberships')
        .select('id')
        .eq('center_id', active.centerId)
        .eq('user_id', cred.user_id)
        .is('left_at', null)
        .maybeSingle();
      allowed = !!shared;
    }
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const signedUrl = await getCredentialSignedUrl(cred.storage_path);
  return NextResponse.redirect(signedUrl);
}
