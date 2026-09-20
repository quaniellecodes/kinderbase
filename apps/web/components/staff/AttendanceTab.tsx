import type { AttendanceData, AttendanceCell } from '@/app/(dashboard)/staff/[userId]/actions';

const CELL: Record<AttendanceCell['status'], string> = {
  present: 'bg-status-green',
  absent: 'bg-status-red',
  leave: 'bg-status-amber',
  off: 'bg-gray-100',
  future: 'bg-gray-50',
};

export function AttendanceTab({ userId, data }: { userId: string; data: AttendanceData }) {
  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Attendance — rolling 90 days</h2>
        <a href={`/api/staff/${userId}/export?kind=attendance`} className="text-xs text-brand hover:underline">Export</a>
      </div>

      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">Overall attendance rate</p>
        <p className="text-sm font-medium text-status-green">{data.rate}%</p>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full bg-status-green" style={{ width: `${data.rate}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat value={data.present} label="Days present" tone="text-status-green" />
        <Stat value={data.unexcused} label="Unexcused" tone="text-status-red" />
        <Stat value={data.pto} label="PTO / leave" tone="text-status-amber" />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {data.weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div key={cell.date} className={`w-3.5 h-3.5 rounded-sm ${CELL[cell.status]}`} title={`${cell.date} · ${cell.status}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-2">
        <Legend c="bg-status-green" t="Present" />
        <Legend c="bg-status-red" t="Absent" />
        <Legend c="bg-status-amber" t="PTO / Leave" />
        <Legend c="bg-gray-100" t="Off / Weekend" />
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="bg-gray-50 rounded-lg py-3 text-center">
      <p className={`text-2xl font-medium ${tone}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
function Legend({ c, t }: { c: string; t: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${c}`} /> {t}</span>;
}
