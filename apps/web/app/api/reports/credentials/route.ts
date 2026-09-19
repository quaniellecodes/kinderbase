import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin, computeCredentialStatus } from '@kinderbase/types';
import { CredentialsReportDocument } from '@/components/pdf/CredentialsReport';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();

  const [{ data: center }, { data: memberships }] = await Promise.all([
    service.from('centers').select('name').eq('id', active.centerId).single(),
    service
      .from('center_memberships')
      .select('users(id, full_name, credentials(id, credential_type, custom_type_name, issuing_org, issued_at, expires_at, deleted_at))')
      .eq('center_id', active.centerId)
      .is('left_at', null),
  ]);

  if (!center) return NextResponse.json({ error: 'Center not found' }, { status: 404 });

  const staff = (memberships ?? [])
    .map(m => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      if (!u) return null;
      const credentials = ((Array.isArray(u.credentials) ? u.credentials : u.credentials ? [u.credentials] : []) as {
        id: string; credential_type: string; custom_type_name: string | null;
        issuing_org: string; issued_at: string; expires_at: string | null; deleted_at: string | null;
      }[])
        .filter(c => !c.deleted_at)
        .map(c => ({ ...c, status: computeCredentialStatus(c.expires_at) }));
      return { id: u.id, full_name: u.full_name, credentials };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && !!s.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const generatedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const buffer = await renderToBuffer(
    createElement(CredentialsReportDocument, { centerName: center.name, staff, generatedAt }) as ReactElement<DocumentProps>
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="credentials-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
