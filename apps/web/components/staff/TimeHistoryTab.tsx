import { Badge, Card, type BadgeTone } from '@/components/ui';
import { clockTime } from '@/lib/format';
import type { TimeHistory, Punch } from '@/app/(dashboard)/staff/[userId]/actions';

const STATUS: Record<Punch['status'], { label: string; tone: BadgeTone }> = {
  on_time: { label: 'On time', tone: 'green' },
  half_day: { label: 'Half day', tone: 'indigo' },
  adj_pending: { label: 'Adj. pending', tone: 'amber' },
  open: { label: 'Clocked in', tone: 'neutral' },
};

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function dur(min: number | null): string {
  if (min == null) return '—';
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
function range(a: string, b: string): string {
  const f = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(a)} – ${f(b)}`;
}

export function TimeHistoryTab({ userId, data, canExport }: { userId: string; data: TimeHistory; canExport: boolean }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="text-sm font-medium text-gray-900">Time history — current pay period</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 whitespace-nowrap">{range(data.periodStart, data.periodEnd)}</span>
          {canExport && <a href={`/api/staff/${userId}/export?kind=time`} className="text-xs text-brand hover:underline whitespace-nowrap">Export to ADP</a>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 mb-3 text-center sm:grid-cols-4">
        <div><p className="text-xl font-medium text-gray-900">{data.totalHours}</p><p className="text-[11px] text-gray-500">Total hrs</p></div>
        <div><p className="text-xl font-medium text-gray-900">{data.overtimeHours}</p><p className="text-[11px] text-gray-500">Overtime</p></div>
        <div><p className="text-xl font-medium text-status-amber">{data.adjPending}</p><p className="text-[11px] text-gray-500">Adj. pending</p></div>
        <div><p className="text-xl font-medium text-status-green">{data.adjApproved}</p><p className="text-[11px] text-gray-500">Adj. approved</p></div>
      </div>

      <div className="divide-y divide-gray-100">
        {data.punches.length === 0 && <p className="text-sm text-gray-400 py-3">No punches this period.</p>}
        {data.punches.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
            <span className="text-gray-500 w-28 flex-shrink-0 whitespace-nowrap">{fmtDay(p.date)}</span>
            <span className="text-status-green whitespace-nowrap">{clockTime(p.inAt)}</span>
            <span className="text-gray-400">–</span>
            <span className="text-gray-500 whitespace-nowrap">{p.outAt ? clockTime(p.outAt) : '—'}</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">{dur(p.minutes)}</span>
            <Badge tone={STATUS[p.status].tone} className="ml-auto whitespace-nowrap">{STATUS[p.status].label}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
