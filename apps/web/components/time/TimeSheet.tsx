import { Card } from '@/components/ui';

type EntryWithUser = {
  id: string;
  user_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes: string | null;
  users?: { full_name: string } | null;
};

type Props = {
  entries: EntryWithUser[];
  showNames: boolean;
};

function formatDuration(inAt: string, outAt: string | null) {
  if (!outAt) return null;
  const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(entries: EntryWithUser[]) {
  const groups = new Map<string, EntryWithUser[]>();
  for (const e of entries) {
    const key = formatDate(e.clocked_in_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

export function TimeSheet({ entries, showNames }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No time entries yet.</p>;
  }

  const groups = groupByDate(entries);

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([date, dayEntries]) => (
        <div key={date}>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{date}</p>
          <Card padding="none" className="divide-y divide-gray-50">
            {dayEntries.map(e => {
              const duration = formatDuration(e.clocked_in_at, e.clocked_out_at);
              return (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {showNames && e.users && (
                      <p className="text-sm font-medium text-gray-900 truncate">{e.users.full_name}</p>
                    )}
                    <p className={`text-sm text-gray-${showNames && e.users ? '500' : '900'}`}>
                      {formatTime(e.clocked_in_at)}
                      {e.clocked_out_at ? ` – ${formatTime(e.clocked_out_at)}` : (
                        <span className="ml-1.5 text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-chip">Active</span>
                      )}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400">
                    {duration ?? '—'}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
