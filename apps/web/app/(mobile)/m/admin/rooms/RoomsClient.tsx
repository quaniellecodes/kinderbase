'use client';

import { useState } from 'react';
import { StatusDot, Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { RoomModeSheet } from '../RoomModeSheet';
import type { AdminRoom } from '../actions';

const ratioColor: Record<AdminRoom['status'], string> = { ok: 'text-status-green', at_minimum: 'text-status-amber', out: 'text-status-red' };
const dot: Record<AdminRoom['status'], 'green' | 'amber' | 'red'> = { ok: 'green', at_minimum: 'amber', out: 'red' };

export function RoomsClient({ rooms }: { rooms: AdminRoom[] }) {
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [modeRoom, setModeRoom] = useState<{ id: string; name: string } | null>(null);
  const list = rooms.filter((r) => filter === 'all' || r.status !== 'ok');

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">Rooms</h1>
      <div className="flex gap-2 mb-3">
        {(['all', 'attention'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('text-[11px] font-semibold px-3 py-1.5 rounded-full border', filter === f ? 'bg-brand text-white border-brand' : 'bg-white border-gray-200 text-gray-600')}>
            {f === 'all' ? 'All rooms' : 'Needs attention'}
          </button>
        ))}
      </div>
      <Card padding="none" className="divide-y divide-gray-50">
        {list.map((r) => (
          <button key={r.id} onClick={() => setModeRoom({ id: r.id, name: r.name })} className="w-full flex items-center gap-3 px-4 py-3 text-left">
            <StatusDot tone={dot[r.status]} />
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{r.name}</p><p className="text-[11px] text-gray-400 truncate">{r.mixText}</p></div>
            <div className="text-right flex-shrink-0"><div className={cn('text-[13px] font-semibold', ratioColor[r.status])}>{r.ratio}</div><div className="text-[10px] text-gray-400">needs {r.required}</div></div>
          </button>
        ))}
        {list.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nothing here.</p>}
      </Card>
      <RoomModeSheet room={modeRoom} onClose={() => setModeRoom(null)} />
    </div>
  );
}
