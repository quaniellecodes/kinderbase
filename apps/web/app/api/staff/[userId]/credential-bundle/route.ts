import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin, computeCredentialStatus } from '@kinderbase/types';
import { CredentialsReportDocument } from '@/components/pdf/CredentialsReport';

// Per-staff credential bundle PDF. Authorized for the staff member or an admin of
// their active center. Reuses the existing center-wide report document.
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const active = getActiveContextFromCookies();
  if (!active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const isSelf = user.id === params.userId;
  if (!isSelf) {
    if (!isAdmin(active.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data: shared } = await service
      .from('center_memberships')
      .select('id')
      .eq('center_id', active.centerId)
      .eq('user_id', params.userId)
      .is('left_at', null)
      .maybeSingle();
    if (!shared) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [{ data: center }, { data: u }] = await Promise.all([
    service.from('centers').select('name').eq('id', active.centerId).single(),
    service
      .from('users')
      .select('id, full_name, credentials(id, credential_type, custom_type_name, issuing_org, issued_at, expires_at, deleted_at)')
      .eq('id', params.userId)
      .single(),
  ]);
  if (!center || !u) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const credentials = ((Array.isArray(u.credentials) ? u.credentials : u.credentials ? [u.credentials] : []) as {
    id: string; credential_type: string; custom_type_name: string | null;
    issuing_org: string; issued_at: string; expires_at: string | null; deleted_at: string | null;
  }[])
    .filter((c) => !c.deleted_at)
    .map((c) => ({ ...c, status: computeCredentialStatus(c.expires_at) }));

  const generatedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const buffer = await renderToBuffer(
    createElement(CredentialsReportDocument, {
      centerName: center.name,
      staff: [{ id: u.id, full_name: u.full_name, credentials }],
      generatedAt,
    }) as ReactElement<DocumentProps>
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="credentials-${u.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    },
  });
}
