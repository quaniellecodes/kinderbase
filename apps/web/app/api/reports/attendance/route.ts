import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { AttendanceReportDocument } from '@/components/pdf/AttendanceReport';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  const service = createServiceClient();

  const [{ data: center }, { data: entries }] = await Promise.all([
    service.from('centers').select('name').eq('id', active.centerId).single(),
    service
      .from('time_entries')
      .select('id, user_id, clocked_in_at, clocked_out_at, notes, users(full_name)')
      .eq('center_id', active.centerId)
      .gte('clocked_in_at', new Date(from).toISOString())
      .lte('clocked_in_at', new Date(to + 'T23:59:59').toISOString())
      .order('clocked_in_at', { ascending: true }),
  ]);

  if (!center) return NextResponse.json({ error: 'Center not found' }, { status: 404 });

  const dateFrom = new Date(from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dateTo = new Date(to).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const generatedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const mappedEntries = (entries ?? []).map(e => ({
    ...e,
    users: Array.isArray(e.users) ? e.users[0] : e.users,
  }));

  const buffer = await renderToBuffer(
    createElement(AttendanceReportDocument, {
      centerName: center.name,
      dateFrom,
      dateTo,
      entries: mappedEntries,
      generatedAt,
    }) as ReactElement<DocumentProps>
  );

  const filename = `attendance-${from}-to-${to}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
