import { NextResponse } from 'next/server';
import { getStaffAttendance, getStaffTimeHistory } from '@/app/(dashboard)/staff/[userId]/actions';

// CSV export for the Attendance and Time-history tabs. ADP integration is future;
// this produces a plain CSV. Auth is enforced by the underlying read actions
// (they return null when the caller can't view this staff member).
export async function GET(req: Request, { params }: { params: { userId: string } }) {
  const kind = new URL(req.url).searchParams.get('kind');

  if (kind === 'attendance') {
    const data = await getStaffAttendance(params.userId);
    if (!data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = [['date', 'status'], ...data.weeks.flat().filter((c) => c.status !== 'future').map((c) => [c.date, c.status])];
    return csv(rows, `attendance-${params.userId}.csv`);
  }

  if (kind === 'time') {
    const data = await getStaffTimeHistory(params.userId);
    if (!data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = [
      ['date', 'clock_in', 'clock_out', 'minutes', 'status'],
      ...data.punches.map((p) => [p.date, p.inAt, p.outAt ?? '', String(p.minutes ?? ''), p.status]),
    ];
    return csv(rows, `time-history-${params.userId}.csv`);
  }

  return NextResponse.json({ error: 'Unknown export kind' }, { status: 400 });
}

function csv(rows: string[][], filename: string): NextResponse {
  const body = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
