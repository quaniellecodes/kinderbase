'use client';

import { useState, useTransition } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { updateTimeEntry } from '@/app/(dashboard)/time/actions';
import { Card, Button } from '@/components/ui';

type Entry = {
  id: string;
  user_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes: string | null;
  users?: { full_name: string } | null;
};

type Props = { entries: Entry[] };

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(inAt: string, outAt: string | null) {
  if (!outAt) return null;
  const mins = Math.floor((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function groupByDate(entries: Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = formatDate(e.clocked_in_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

function EntryRow({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const [inVal, setInVal] = useState(toLocalDatetimeValue(entry.clocked_in_at));
  const [outVal, setOutVal] = useState(entry.clocked_out_at ? toLocalDatetimeValue(entry.clocked_out_at) : '');
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateTimeEntry(
        entry.id,
        new Date(inVal).toISOString(),
        outVal ? new Date(outVal).toISOString() : null
      );
      setEditing(false);
    });
  }

  function handleCancel() {
    setInVal(toLocalDatetimeValue(entry.clocked_in_at));
    setOutVal(entry.clocked_out_at ? toLocalDatetimeValue(entry.clocked_out_at) : '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-2">
        {entry.users && (
          <p className="text-xs font-medium text-gray-500">{entry.users.full_name}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Clock in</label>
            <input
              type="datetime-local"
              value={inVal}
              onChange={e => setInVal(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Clock out</label>
            <input
              type="datetime-local"
              value={outVal}
              onChange={e => setOutVal(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="gap-1 text-xs"
          >
            <Check className="w-3 h-3" /> Save
          </Button>
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="gap-1 text-xs text-gray-600"
          >
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  const duration = formatDuration(entry.clocked_in_at, entry.clocked_out_at);
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        {entry.users && (
          <p className="text-sm font-medium text-gray-900 truncate">{entry.users.full_name}</p>
        )}
        <p className="text-sm text-gray-500">
          {formatTime(entry.clocked_in_at)}
          {entry.clocked_out_at
            ? ` – ${formatTime(entry.clocked_out_at)}`
            : <span className="ml-1.5 text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-chip">Active</span>
          }
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400">{duration ?? '—'}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-gray-300 hover:text-gray-500 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AdminTimeSheet({ entries }: Props) {
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
            {dayEntries.map(e => <EntryRow key={e.id} entry={e} />)}
          </Card>
        </div>
      ))}
    </div>
  );
}
