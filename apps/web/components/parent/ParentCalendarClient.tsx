'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthCells } from '@kinderbase/core';
import { cn } from '@/lib/utils';
import type { ParentCalEntry } from '@/lib/parent/calendar';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function longDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Family-facing center calendar. Two tabs mirroring the staff view: a month grid
 * (like the teacher's CalendarClient) and a Timeline agenda of what's coming up.
 * Read-only — parents can't create or edit events. Entries are already filtered
 * to the family audience server-side (lib/parent/calendar.ts).
 */
export function ParentCalendarClient({ entries, centerName, todayIso }: { entries: ParentCalEntry[]; centerName: string; todayIso: string }) {
  const [tab, setTab] = useState<'calendar' | 'timeline'>('calendar');
  const [ym, setYm] = useState<[number, number]>([Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1]);
  const [sel, setSel] = useState(todayIso);
  const [y, m] = ym;

  const byDate = useMemo(() => {
    const map = new Map<string, ParentCalEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [entries]);
  const cells = useMemo(() => monthCells(y, m), [y, m]);
  const dayItems = byDate.get(sel) ?? [];

  function move(delta: number) {
    let nm = m + delta;
    let ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYm([ny, nm]);
  }

  const calendarView = (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => move(-1)} aria-label="Previous month" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-[15px] font-semibold text-gray-900 min-w-[130px]">{MONTH_NAMES[m]} {y}</div>
        <button onClick={() => move(1)} aria-label="Next month" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500"><ChevronRight className="w-4 h-4" /></button>
        <span className="flex-1" />
        <button onClick={() => { setYm([Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1]); setSel(todayIso); }} className="text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">Today</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden text-[11px]">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i} className="py-2 text-center text-[10.5px] font-semibold text-gray-400">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c) => {
            const evs = byDate.get(c.iso) ?? [];
            return (
              <button
                key={c.iso}
                onClick={() => setSel(c.iso)}
                className={cn('relative text-left border-r border-b border-gray-100 p-1.5 align-top min-h-[52px]', c.outside && 'bg-gray-50/60 opacity-60', c.iso === sel && 'ring-2 ring-brand ring-inset z-10')}
              >
                <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11.5px] font-semibold', c.iso === todayIso ? 'bg-brand text-white' : 'text-gray-700')}>{Number(c.iso.slice(8, 10))}</span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {evs.slice(0, 4).map((e, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: e.colour }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-3">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[14px] font-semibold text-gray-900">{longDate(sel)}</p>
          <p className="text-[11.5px] text-gray-500">{dayItems.length ? `${dayItems.length} event${dayItems.length > 1 ? 's' : ''}` : 'Nothing scheduled'}</p>
        </div>
        {dayItems.length === 0 ? (
          <p className="text-center text-gray-400 text-[13px] py-8">Nothing on this day.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {dayItems.map((e) => (
              <div key={e.id} className="flex gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: `${e.colour}1f` }}>{e.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">{e.title}</p>
                  {(e.timeLabel || e.detail) && <p className="text-[11.5px] text-gray-500 mt-0.5">{[e.timeLabel, e.detail].filter(Boolean).join(' · ')}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const days = useMemo(() => [...new Set(entries.map((e) => e.date))].sort(), [entries]);
  const timelineView = days.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Nothing on the calendar right now.</div>
  ) : (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{d === todayIso ? 'Today' : longDate(d)}</p>
          <div className="space-y-2">
            {entries.filter((e) => e.date === d).map((e) => (
              <div key={e.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3" style={{ borderLeft: `3px solid ${e.colour}` }}>
                <span className="text-base flex-shrink-0">{e.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{e.title}</p>
                  {(e.timeLabel || e.detail) && <p className="text-[11px] text-gray-500 mt-0.5">{[e.timeLabel, e.detail].filter(Boolean).join(' · ')}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-0.5">Calendar</h1>
      <p className="text-xs text-gray-500 mb-3">What&apos;s coming up at {centerName}.</p>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {(['calendar', 'timeline'] as const).map((v) => (
          <button key={v} onClick={() => setTab(v)} className={cn('flex-1 py-1.5 rounded-lg text-[13px] font-semibold capitalize', tab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>{v}</button>
        ))}
      </div>

      {tab === 'calendar' ? calendarView : timelineView}
    </div>
  );
}
