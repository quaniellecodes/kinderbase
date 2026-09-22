'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Coffee, Moon, Utensils, Camera, Mic, ChevronDown } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Badge, Button, StatusDot, toast, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { UpdateType } from '@kinderbase/types';
import { logChildUpdate, setNapState, startBreak, endBreak, type MobileRoom, type FeedItem, type LessonPlan, type RoutineBlock } from '../actions';
import { LessonPlanTab } from './LessonPlanTab';
import { ScheduleTab } from './ScheduleTab';

const STATUS: Record<MobileRoom['evaluation']['status'], { label: string; tone: BadgeTone; dot: 'green' | 'amber' | 'red' }> = {
  ok: { label: 'In ratio', tone: 'green', dot: 'green' },
  at_minimum: { label: 'At minimum', tone: 'amber', dot: 'amber' },
  out: { label: 'Out of ratio', tone: 'red', dot: 'red' },
};
const LOG_TYPES: { type: UpdateType; label: string; emoji: string }[] = [
  { type: 'meal', label: 'Meal', emoji: '🍼' },
  { type: 'nap', label: 'Nap', emoji: '💤' },
  { type: 'milestone', label: 'Milestone', emoji: '⭐' },
  { type: 'incident', label: 'Incident', emoji: '⚠️' },
];
const NAP_STATES: { key: 'settling' | 'resting' | 'awake'; label: string }[] = [
  { key: 'settling', label: 'Settling' },
  { key: 'resting', label: 'All resting quietly' },
  { key: 'awake', label: 'Nap over' },
];

export function ClassroomView({
  room,
  feed,
  plan,
  routine,
  rooms,
}: {
  room: MobileRoom;
  feed: FeedItem[];
  plan: LessonPlan | null;
  routine: RoutineBlock[];
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'plan' | 'schedule' | 'feed'>('overview');
  const [picker, setPicker] = useState(false);
  const [why, setWhy] = useState<{ blocked?: { reasons: string[]; hint: string } } | null>(null);
  const [log, setLog] = useState<{ childIds: string[]; type: UpdateType; note: string } | null>(null);
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const st = STATUS[room.evaluation.status];
  const present = room.children.filter((c) => c.present);
  const needUpdate = present.filter((c) => c.updatesToday === 0).length;

  function refresh() {
    router.refresh();
  }
  function openLogFor(childIds: string[], type: UpdateType = 'meal') {
    setLog({ childIds, type, note: '' });
  }
  function tapChild(id: string) {
    if (selMode) {
      setSel((s) => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
    } else openLogFor([id]);
  }
  function postLog() {
    if (!log) return;
    start(async () => {
      await logChildUpdate(room.id, { childIds: log.childIds, type: log.type, body: log.note });
      setLog(null);
      setSelMode(false);
      setSel(new Set());
      refresh();
      toast('Update posted');
    });
  }
  function toggleBreak(staffId: string, onBreak: boolean, isSelf: boolean) {
    if (!isSelf && !room.me.isAdmin) return;
    start(async () => {
      if (onBreak) {
        await endBreak(room.id, isSelf ? undefined : staffId);
        refresh();
        return;
      }
      const res = await startBreak(room.id, isSelf ? undefined : staffId);
      if (!res.ok) setWhy({ blocked: { reasons: res.reasons ?? [], hint: res.hint ?? '' } });
      else refresh();
    });
  }
  function nap(state: 'settling' | 'resting' | 'awake') {
    start(async () => {
      await setNapState(room.id, state);
      refresh();
    });
  }

  const num = (v: number, l: string, warn = false) => (
    <div className="flex-1 text-center py-2">
      <div className={cn('text-lg font-semibold', warn ? 'text-status-red' : 'text-gray-900')}>{v}</div>
      <div className="text-[10px] text-gray-400">{l}</div>
    </div>
  );

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between gap-2">
          <button className="min-w-0 text-left" onClick={() => rooms.length > 1 && setPicker(true)}>
            <h1 className="text-[17px] font-semibold text-gray-900 truncate flex items-center gap-1">
              {room.name}
              {rooms.length > 1 && <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {room.staff.filter((s) => !s.onBreak).map((s) => s.name.split(' ')[0]).join(' · ') || 'No staff on floor'}
            </p>
          </button>
          <button
            onClick={() => setWhy({})}
            className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
              st.tone === 'green' ? 'bg-green-50 text-green-700' : st.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}
          >
            <StatusDot tone={st.dot} /> {st.label}
          </button>
        </div>
        <div className="flex gap-5 mt-3 overflow-x-auto">
          {(['overview', 'plan', 'schedule', 'feed'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('text-[13px] font-semibold pb-2.5 border-b-2 whitespace-nowrap capitalize',
                tab === k ? 'text-brand border-brand' : 'text-gray-400 border-transparent')}
            >
              {k === 'plan' ? 'Lesson plan' : k}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="p-4 space-y-4">
          {/* Numbers */}
          <div className="flex rounded-card border border-gray-100 bg-white divide-x divide-gray-100">
            {num(present.length, 'Here now')}
            {num(room.evaluation.present, 'Staff', !room.evaluation.ok)}
            {num(room.evaluation.requiredNow, 'Required')}
            {num(needUpdate, 'Need update', needUpdate > 0)}
          </div>

          {/* Compliance strip */}
          <button
            onClick={() => setWhy({})}
            className={cn('w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px]',
              st.tone === 'green' ? 'bg-green-50 text-green-800' : st.tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800')}
          >
            <span className="w-5 h-5 rounded-full bg-white/70 flex items-center justify-center font-bold">{room.evaluation.ok ? '✓' : '!'}</span>
            <span className="flex-1">
              <b>{room.evaluation.ruleName}</b> · needs {room.evaluation.requiredNow}, has {room.evaluation.present}
              <br />
              <span className="opacity-80">{room.evaluation.mixText}</span>
            </span>
            <span className="opacity-50">›</span>
          </button>

          {/* Quick log */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick log</p>
            <div className="grid grid-cols-2 gap-2">
              <QuickBtn icon={<Moon className="w-4 h-4" />} label="Batch nap" onClick={() => { setSelMode(true); setSel(new Set(present.map((c) => c.id))); openLogFor(present.map((c) => c.id), 'nap'); }} />
              <QuickBtn icon={<Utensils className="w-4 h-4" />} label="Batch meal" onClick={() => { setSelMode(true); setSel(new Set(present.map((c) => c.id))); openLogFor(present.map((c) => c.id), 'meal'); }} />
              <QuickBtn icon={<Camera className="w-4 h-4" />} label="Photo post" onClick={() => toast('Photo capture arrives in Phase 2b')} />
              <QuickBtn icon={<Mic className="w-4 h-4" />} label="Observation" onClick={() => toast('Voice observation arrives in Phase 2b')} />
            </div>
          </div>

          {/* In the room */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">In the room</p>
            <div className="rounded-card border border-gray-100 bg-white divide-y divide-gray-50">
              {room.staff.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">Nobody on the floor</p>}
              {room.staff.map((s) => (
                <div key={s.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.onBreak && 'opacity-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}{s.isSelf ? ' (you)' : ''}</p>
                    <p className="text-[11px] text-gray-400">{s.onBreak ? 'On break · on premises' : 'On the floor'}</p>
                  </div>
                  <Badge tone={s.leadForGroup ? 'blue' : 'amber'} size="sm">{s.leadForGroup ? 'Lead' : 'Aide'}</Badge>
                  {(s.isSelf || room.me.isAdmin) && (
                    <button onClick={() => toggleBreak(s.id, s.onBreak, s.isSelf)} disabled={pending} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600">
                      {s.onBreak ? 'Back' : 'Break'}
                    </button>
                  )}
                </div>
              ))}
              <div className="px-4 py-2.5">
                <p className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1"><Coffee className="w-3 h-3" /> Nap status</p>
                <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
                  {NAP_STATES.map((n) => (
                    <button key={n.key} onClick={() => nap(n.key)} disabled={pending}
                      className={cn('flex-1 text-[11px] font-medium py-1.5 rounded-md', room.napState === n.key ? 'bg-brand text-white' : 'text-gray-500')}>
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Children */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Children</p>
              <button onClick={() => { setSelMode((v) => !v); setSel(new Set()); }} className="text-[11px] font-semibold text-brand">
                {selMode ? 'Cancel' : 'Select multiple'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {room.children.map((c) => (
                <button key={c.id} onClick={() => tapChild(c.id)} disabled={!c.present && !selMode}
                  className={cn('relative rounded-card border bg-white p-2 flex flex-col items-center gap-1', sel.has(c.id) ? 'border-brand ring-1 ring-brand' : 'border-gray-100', !c.present && 'opacity-45')}>
                  <span className={cn('absolute top-1 right-1 text-[9px] font-bold px-1.5 rounded', c.updatesToday ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{c.updatesToday}</span>
                  <div className="relative w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center text-sm font-medium">
                    {c.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                    {c.allergy && <span className="absolute -left-1 -top-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center border-2 border-white">!</span>}
                    <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5"><StatusDot tone={c.present ? 'green' : 'gray'} /></span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-900 truncate max-w-full">{c.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-gray-400">{c.ageLabel} · {c.bandLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'feed' && (
        <div className="p-4 space-y-2">
          {feed.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No updates yet.</p>
          ) : feed.map((f) => (
            <div key={f.id} className="rounded-card border border-gray-100 bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-900">{f.author}</span>
                {f.covering && <Badge tone="purple" size="sm">covering</Badge>}
                <span className="text-[10px] text-gray-400 ml-auto">{new Date(f.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm text-gray-700">{f.body}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Badge tone="neutral" size="sm">{f.type}</Badge>
                {f.children.map((c) => <Badge key={c} tone="blue" size="sm">{c}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'plan' && (plan ? <LessonPlanTab plan={plan} /> : <div className="p-4 text-sm text-gray-400 text-center py-10">No lesson plan.</div>)}
      {tab === 'schedule' && <ScheduleTab blocks={routine} />}

      {/* Classroom picker */}
      <BottomSheet open={picker} onClose={() => setPicker(false)} title="Switch classroom">
        <div className="space-y-1 pb-2">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/m/classroom/${r.id}`}
              onClick={() => setPicker(false)}
              className={cn('flex items-center px-3 py-3 rounded-lg text-sm', r.id === room.id ? 'bg-brand/5 text-brand font-medium' : 'text-gray-700')}
            >
              {r.name}
            </Link>
          ))}
        </div>
      </BottomSheet>

      {/* Select bar */}
      {selMode && !log && (
        <div className="fixed bottom-[68px] inset-x-0 z-30 bg-brand text-white px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm font-semibold flex-1">{sel.size} selected</span>
          <button onClick={() => setSel(new Set(present.map((c) => c.id)))} className="text-xs font-semibold px-2.5 py-1 rounded bg-white/20">All</button>
          <button onClick={() => openLogFor([...sel])} disabled={!sel.size} className="text-xs font-semibold px-3 py-1 rounded bg-white text-brand disabled:opacity-40">Log {sel.size || ''}</button>
        </div>
      )}

      {/* Why sheet */}
      <BottomSheet open={!!why} onClose={() => setWhy(null)} title={room.name}>
        {why?.blocked && (
          <div className="rounded-lg bg-red-50 p-3 mb-3">
            <p className="text-sm font-semibold text-red-800 mb-1">That break won’t hold right now</p>
            {why.blocked.reasons.map((r, i) => <p key={i} className="text-xs text-red-700">· {r}</p>)}
            {why.blocked.hint && <p className="text-xs text-amber-800 bg-amber-50 rounded p-2 mt-2">{why.blocked.hint}</p>}
          </div>
        )}
        <div className="rounded-lg bg-gray-50 p-3 mb-2">
          <p className="text-sm font-semibold text-gray-900">{room.evaluation.ruleName}</p>
          <p className="text-[11px] text-gray-500">{room.evaluation.citation} · {room.evaluation.mixText}</p>
        </div>
        <div className="divide-y divide-gray-50">
          {room.evaluation.checks.map((c) => (
            <div key={c.key} className="flex items-start gap-2 py-2">
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0', c.pass ? 'bg-status-green' : 'bg-status-red')}>{c.pass ? '✓' : '✗'}</span>
              <div>
                <p className="text-xs font-semibold text-gray-900 capitalize">{c.key === 'lead' ? 'Lead teacher' : c.key === 'staff' ? 'Staff in room' : c.key === 'size' ? 'Group size' : 'Nap'}</p>
                <p className="text-[11px] text-gray-500">{c.message}</p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" className="w-full mt-3" onClick={() => setWhy(null)}>Close</Button>
      </BottomSheet>

      {/* Log sheet */}
      <BottomSheet open={!!log} onClose={() => setLog(null)} title={log && log.childIds.length > 1 ? `Log for ${log.childIds.length}` : 'Log update'}>
        {log && (
          <div className="space-y-3 pb-2">
            <div className="grid grid-cols-4 gap-2">
              {LOG_TYPES.map((t) => (
                <button key={t.type} onClick={() => setLog({ ...log, type: t.type })}
                  className={cn('rounded-xl border py-3 flex flex-col items-center gap-1', log.type === t.type ? 'border-brand bg-brand/5' : 'border-gray-100')}>
                  <span className="text-lg">{t.emoji}</span>
                  <span className="text-[10px] font-medium text-gray-700">{t.label}</span>
                </button>
              ))}
            </div>
            <textarea value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} rows={2} placeholder="Optional note…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-[11px] text-gray-400">{room.me.isAdmin ? 'Posts as you · covering — not counted toward any teacher score' : 'Posts as you'}</p>
            <Button className="w-full gap-1.5" onClick={postLog} disabled={pending}>
              <Check className="w-4 h-4" /> {pending ? 'Posting…' : `Post update${log.childIds.length > 1 ? ` (${log.childIds.length})` : ''}`}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-card border border-gray-100 bg-white px-3 py-3">
      <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="text-[12px] font-medium text-gray-800">{label}</span>
    </button>
  );
}
