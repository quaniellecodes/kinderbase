'use client';

import { cn } from '@/lib/utils';
import type { RoutineBlock } from '../actions';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}
function label(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h! >= 12 ? 'PM' : 'AM';
  const hh = h! % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function ScheduleTab({ blocks }: { blocks: RoutineBlock[] }) {
  if (!blocks.length) return <div className="p-4 text-sm text-gray-400 text-center py-10">No routine set for this room.</div>;
  return (
    <div className="p-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Daily routine</p>
      <div className="relative pl-5">
        <div className="absolute left-[5px] top-1.5 bottom-1.5 w-0.5 bg-gray-100" />
        {blocks.map((b, i) => (
          <div key={i} className="relative mb-2.5">
            <span className={cn('absolute -left-[17px] top-3 w-2.5 h-2.5 rounded-full border-2', b.isNow ? 'bg-brand border-brand ring-2 ring-brand/20' : 'bg-white border-gray-300')} />
            <div className={cn('rounded-card border p-2.5', b.isNow ? 'border-brand bg-orange-50/40' : 'border-gray-100 bg-white', !b.upcoming && !b.isNow && 'opacity-55')}>
              <div className="flex items-baseline gap-2">
                <span className={cn('text-[11px] font-bold', b.isNow ? 'text-brand' : 'text-gray-400')}>{label(b.startsAt)}</span>
                <span className="text-[13px] font-semibold text-gray-900 flex-1">{b.title}</span>
                {b.isNow && <span className="text-[9px] font-bold bg-brand text-white rounded px-1.5 py-0.5">NOW</span>}
              </div>
              {b.detail && <p className="text-[11px] text-gray-500 mt-0.5">{b.detail}</p>}
              {b.staff.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {b.staff.map((s) => (
                    <span key={s} className="w-5 h-5 rounded-full bg-brand text-white text-[8px] font-semibold flex items-center justify-center">{initials(s)}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
