'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Megaphone, Check, DoorOpen, ChevronRight } from 'lucide-react';
import { Card, Avatar, buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { completeTask, type TodayData, type Priority } from './actions';

export function TodayClient({ data }: { data: TodayData }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle(taskId: string) {
    start(async () => {
      await completeTask(taskId);
      router.refresh();
    });
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          {data.greeting}, {data.firstName}
        </h1>
        <p className="text-xs text-gray-500">{data.dateLabel} · {data.timeLabel}</p>
      </div>

      {/* Float hero */}
      {data.isFloat && (
        <div className={cn('rounded-card p-4 text-white', data.float?.here ? 'bg-gradient-to-br from-amber-800 to-amber-950' : 'bg-gradient-to-br from-neutral-600 to-neutral-800')}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{data.float?.here ? "You're in now" : 'Right now'}</p>
          <p className="text-lg font-semibold mt-0.5">{data.float?.here ? data.float.here.room : 'On call'}</p>
          <p className="text-xs opacity-85 mt-0.5">{data.float?.here ? `Until ${data.float.here.to}` : "No room yet — you'll be notified the moment you're assigned."}</p>
          {data.float?.here?.roomId && (
            <Link href={`/m/classroom/${data.float.here.roomId}`} className="inline-block mt-3 text-xs font-semibold bg-white/20 rounded-lg px-3 py-1.5">Open room</Link>
          )}
        </div>
      )}

      {/* From management */}
      {data.announcements.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">From management</p>
          <div className="space-y-2">
            {data.announcements.map((a) => (
              <Card key={a.id} padding="compact">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-3.5 h-3.5 text-brand" />
                  <span className="text-xs font-semibold text-gray-900">{a.author}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
                <p className="text-[13px] text-gray-700 leading-snug">{a.body}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Priorities */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Priorities</p>
          <span className="text-[11px] font-semibold text-brand">{data.priorities.filter((p) => p.urgency !== 'done').length || 'all'} {data.priorities.some((p) => p.urgency !== 'done') ? 'open' : 'clear'}</span>
        </div>
        <Card padding="none" className="divide-y divide-gray-50">
          {data.priorities.map((p) => <PriorityRow key={p.key} p={p} pending={pending} onToggle={toggle} />)}
          {data.moreCount > 0 && <div className="px-4 py-2.5 text-center text-[11px] font-semibold text-brand">{data.moreCount} more this week</div>}
        </Card>
      </section>

      {/* My shift */}
      {!data.isFloat && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">My shift</p>
          <Card padding="none" className="divide-y divide-gray-50">
            {data.shift.clockIn && (
              <Row dot="green" label="Clocked in at kiosk" right={data.shift.clockIn} />
            )}
            {data.shift.blocks.map((b, i) => (
              <Row key={i} dot={b.now ? 'brand' : 'green'} label={`${b.room ?? 'On call'} · ${b.role}`} right={`${b.from} – ${b.to}`} bold={b.now} />
            ))}
            {data.shift.blocks.length === 0 && !data.shift.clockIn && <p className="text-sm text-gray-400 px-4 py-3">No shift scheduled today.</p>}
          </Card>
        </section>
      )}

      {/* Float day timeline */}
      {data.isFloat && data.shift.blocks.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Your day</p>
          <Card padding="none" className="divide-y divide-gray-50">
            {data.shift.blocks.map((b, i) => (
              <Row key={i} dot={b.now ? 'brand' : 'green'} label={b.room ?? 'On call'} right={`${b.from} – ${b.to}`} bold={b.now} />
            ))}
          </Card>
        </section>
      )}

      {/* Spotlights */}
      {data.spotlights.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">This month</p>
          <Card>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">🌟</span>
              <span className="text-[13px] font-semibold text-gray-900">Spotlights</span>
              <span className="text-[10px] text-gray-400">Specific wins, not rankings</span>
            </div>
            <div className="divide-y divide-gray-50">
              {data.spotlights.map((s) => (
                <div key={s.category} className="flex items-center gap-2.5 py-2">
                  <Avatar name={s.name} size="sm" />
                  <span className="text-[13px] font-medium text-gray-900 flex-1">{s.name.split(' ')[0]}</span>
                  <span className="text-[11px] text-gray-500">{s.category}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

function PriorityRow({ p, pending, onToggle }: { p: Priority; pending: boolean; onToggle: (id: string) => void }) {
  const bar = p.urgency === 'red' ? 'bg-status-red' : p.urgency === 'amber' ? 'bg-status-amber' : 'bg-gray-200';
  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={cn('w-1 self-stretch rounded-full flex-shrink-0', bar)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold', p.urgency === 'done' ? 'text-gray-400 line-through' : 'text-gray-900')}>{p.title}</p>
        <p className="text-[11px] text-gray-500">{p.sub}</p>
        {p.faces && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {p.faces.map((f) => (
              <Link key={f.id} href={`/m/classroom/${f.classroomId}`} className="flex flex-col items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="relative"><Avatar name={f.name} size="md" /><span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-brand text-white text-[11px] flex items-center justify-center border-2 border-white leading-none">+</span></div>
                <span className="text-[10px] text-gray-500">{f.name.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      {p.taskId ? (
        <button onClick={() => onToggle(p.taskId!)} disabled={pending} className="w-6 h-6 rounded-md border-2 border-gray-200 flex-shrink-0 mt-0.5" aria-label="Complete" />
      ) : p.urgency === 'done' ? (
        <span className="w-6 h-6 rounded-md bg-status-green flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="w-3.5 h-3.5 text-white" /></span>
      ) : p.href ? (
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
      ) : null}
    </div>
  );
  return p.href && !p.faces ? <Link href={p.href} className="block active:bg-gray-50">{inner}</Link> : inner;
}

function Row({ dot, label, right, bold }: { dot: 'green' | 'brand'; label: string; right: string; bold?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dot === 'brand' ? 'bg-brand' : 'bg-status-green')} />
      <span className={cn('text-[13px] flex-1', bold ? 'font-semibold text-gray-900' : 'text-gray-700')}>{label}</span>
      <span className="text-[11px] text-gray-500 tabular-nums">{right}</span>
    </div>
  );
}
