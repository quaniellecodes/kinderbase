'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, Coffee, ChevronLeft } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, Input, buttonVariants, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { clockTime, formatHours, formatDayLabel, formatWeekOf } from '@/lib/format';
import type { StaffState, ChildState } from '@kinderbase/core';
import type { TimeLog, MyTimesheet, StaffLogRow, ChildLogRow } from '@/app/(dashboard)/timelog/actions';
import { LiveElapsed } from './LiveElapsed';

const STAFF_STATE: Record<StaffState, { label: string; tone: BadgeTone }> = {
  in: { label: 'On the floor', tone: 'green' },
  break: { label: 'On break', tone: 'amber' },
  late: { label: 'Not in yet', tone: 'red' },
  out: { label: 'Clocked out', tone: 'neutral' },
  oncall: { label: 'On call', tone: 'blue' },
};
const CHILD_STATE: Record<ChildState, { label: string; tone: BadgeTone }> = {
  here: { label: 'Signed in', tone: 'green' },
  gone: { label: 'Signed out', tone: 'neutral' },
  absent: { label: 'Absent', tone: 'red' },
};

type Variant = 'desktop' | 'mobile';

export function TimeLogView(props: ({ mode: 'admin'; log: TimeLog } | { mode: 'me'; sheet: MyTimesheet }) & { title: string; variant: Variant; back?: string }) {
  const pad = props.variant === 'desktop' ? 'p-4 md:p-8' : 'p-4';
  return (
    <div className={cn('w-full', pad)}>
      <div className="max-w-[1100px] mx-auto">
        {props.back && (
          <Link href={props.back} className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        )}
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">{props.title}</h1>
        {props.mode === 'admin' ? <AdminTimeLog log={props.log} /> : <MyTimesheetView sheet={props.sheet} />}
        <p className="text-[11px] text-gray-400 text-center mt-5">Punches come from the kiosk — nobody edits one here.</p>
      </div>
    </div>
  );
}

// ── Admin: the log ───────────────────────────────────────────────────────────

function AdminTimeLog({ log }: { log: TimeLog }) {
  const [tab, setTab] = useState<'staff' | 'children'>('staff');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const staffRows = useMemo(
    () => log.staff.filter((r) => (!filter || r.state === filter) && (!query || r.name.toLowerCase().includes(query))),
    [log.staff, filter, query],
  );
  const childRows = useMemo(
    () => log.children.filter((r) => (!filter || r.state === filter) && (!query || r.name.toLowerCase().includes(query))),
    [log.children, filter, query],
  );

  const staffChips: { key: StaffState | null; label: string; n: number }[] = [
    { key: null, label: 'Everyone', n: log.staff.length },
    { key: 'in', label: 'On the floor', n: log.staffSummary.onFloor },
    { key: 'break', label: 'On break', n: log.staffSummary.onBreak },
    { key: 'late', label: 'Not in yet', n: log.staffSummary.notIn },
    { key: 'out', label: 'Clocked out', n: log.staffSummary.out },
  ];
  const childChips: { key: ChildState | null; label: string; n: number }[] = [
    { key: null, label: 'All', n: log.children.length },
    { key: 'here', label: 'Signed in', n: log.childSummary.here },
    { key: 'gone', label: 'Signed out', n: log.childSummary.gone },
    { key: 'absent', label: 'Absent', n: log.childSummary.absent },
  ];
  const chips = tab === 'staff' ? staffChips : childChips;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100">
        {(['staff', 'children'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setFilter(null); }}
            className={cn('pb-2 text-sm font-medium -mb-px border-b-2', tab === t ? 'border-brand text-gray-900' : 'border-transparent text-gray-400')}
          >
            {t === 'staff' ? 'Staff' : 'Students'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'staff' ? 'Search staff' : 'Search students'} className="pl-9" />
      </div>

      {/* Filter chips with counts */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter(c.key as string | null)}
            className={cn('px-3 py-1 rounded-chip text-xs font-medium border', (filter ?? null) === (c.key ?? null) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200')}
          >
            {c.label} <span className="opacity-70">· {c.n}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <Card padding="none">
        <div className="divide-y divide-gray-100">
          {tab === 'staff'
            ? (staffRows.length ? staffRows.map((r) => <StaffRow key={r.userId} r={r} nowISO={log.now} />) : <Empty label="No staff match." />)
            : (childRows.length ? childRows.map((r) => <ChildRow key={r.childId} r={r} />) : <Empty label="No students match." />)}
        </div>
      </Card>
    </div>
  );
}

function StaffRow({ r, nowISO }: { r: StaffLogRow; nowISO: string }) {
  const meta = STAFF_STATE[r.state];
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5', r.rosterMismatch && 'bg-red-50/60')}>
      <Avatar name={r.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
          <Badge tone={meta.tone} size="sm" className="flex-shrink-0">{meta.label}</Badge>
        </div>
        <div className="text-xs text-gray-500 truncate">{r.room} · {r.roleLabel}</div>
        {r.rosterMismatch && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-red-700 mt-0.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Counted in ratio but no punch — room may be short.
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {r.state === 'in' && r.punchIn && (
          <>
            <div className="text-sm font-semibold text-green-700 tabular-nums"><LiveElapsed fromISO={r.punchIn} serverNowISO={nowISO} /></div>
            <div className="text-[11px] text-gray-400">since {clockTime(r.punchIn)}</div>
          </>
        )}
        {r.state === 'break' && r.onBreakSince && (
          <>
            <div className="flex items-center justify-end gap-1 text-sm font-semibold text-amber-700 tabular-nums"><Coffee className="w-3.5 h-3.5" /><LiveElapsed fromISO={r.onBreakSince} serverNowISO={nowISO} /></div>
            <div className="text-[11px] text-gray-400">on break</div>
          </>
        )}
        {r.state === 'out' && (
          <>
            <div className="text-sm font-semibold text-gray-900">{formatHours(r.workedHours)}</div>
            <div className="text-[11px] text-gray-400">{r.punchOut ? `out ${clockTime(r.punchOut)}` : 'worked'}</div>
          </>
        )}
        {r.state === 'late' && <div className="text-[11px] text-red-600 max-w-[140px]">{r.label}</div>}
        {r.state === 'oncall' && <div className="text-[11px] text-gray-400">Not scheduled</div>}
      </div>
    </div>
  );
}

function ChildRow({ r }: { r: ChildLogRow }) {
  const meta = CHILD_STATE[r.state];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Avatar name={r.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
          <Badge tone={meta.tone} size="sm" className="flex-shrink-0">{meta.label}</Badge>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {r.room}
          {r.signedInBy && r.state !== 'absent' && <> · in by {r.signedInBy}</>}
          {r.signedOutBy && r.state === 'gone' && <> · out by {r.signedOutBy}</>}
        </div>
      </div>
      <div className="text-right flex-shrink-0 text-[11px] text-gray-400">
        {r.signedInAt && <div>in {clockTime(r.signedInAt)}</div>}
        {r.signedOutAt && <div>out {clockTime(r.signedOutAt)}</div>}
        {!r.signedInAt && <div>—</div>}
      </div>
    </div>
  );
}

// ── Teacher: my week ───────────────────────────────────────────────────────────

function MyTimesheetView({ sheet }: { sheet: MyTimesheet }) {
  const { totals } = sheet;
  const pct = totals.scheduled > 0 ? Math.min(100, Math.round((totals.worked / totals.scheduled) * 100)) : 0;
  return (
    <div className="space-y-3">
      <Card padding="default">
        <div className="text-xs text-gray-500">{formatWeekOf(sheet.weekOf)}</div>
        <div className="text-2xl font-semibold text-gray-900 mt-0.5">{formatHours(totals.worked)} <span className="text-sm font-normal text-gray-400">worked</span></div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] text-gray-500 mt-1.5">
          {formatHours(totals.onClock)} on the clock · {formatHours(totals.breaks)} in breaks · {formatHours(totals.scheduled)} scheduled
        </div>
      </Card>

      <Card padding="none">
        <div className="divide-y divide-gray-100">
          {sheet.days.map((d) => {
            const live = d.isToday && d.isOpen && d.punchIn;
            return (
              <div key={d.date} className={cn('flex items-center gap-3 px-3 py-2.5', d.isToday && 'bg-brand/5')}>
                <div className="w-16 text-sm font-medium text-gray-900 flex-shrink-0">{formatDayLabel(d.date)}</div>
                <div className="min-w-0 flex-1 text-xs text-gray-500">
                  {d.punchIn ? (
                    <>
                      {clockTime(d.punchIn)}{d.punchOut ? ` – ${clockTime(d.punchOut)}` : ' – now'}
                      {d.breakCount > 0 && <> · {d.breakCount} break{d.breakCount > 1 ? 's' : ''} ({formatHours(d.breakMinutes / 60)})</>}
                    </>
                  ) : d.scheduledHours > 0 ? (
                    <span className="text-amber-600">Scheduled {formatHours(d.scheduledHours)} · no punch</span>
                  ) : (
                    <span className="text-gray-400">No shift</span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {live ? (
                    <div className="text-sm font-semibold text-green-700 tabular-nums"><LiveElapsed fromISO={d.punchIn!} serverNowISO={sheet.now} /></div>
                  ) : (
                    <div className="text-sm font-semibold text-gray-900">{d.punchIn ? formatHours(d.workedHours) : '—'}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Link href="/requests/new" className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'w-full')}>Request a correction</Link>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <EmptyState title={label} />;
}
