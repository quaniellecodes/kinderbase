'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal, Button, Input, Select, Label, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { FloatSheet } from '@/app/(mobile)/m/admin/FloatSheet';
import { monthCells, type CalType } from '@kinderbase/core';
import { getCalendar, createEvent, deleteEvent, decideTimeOff, setTypeVisibility, createType, deleteType, countTypeEvents, type CalendarResult } from './actions';
import { CAL_EMOJIS, CAL_COLOURS, MONTH_NAMES, monthRange, longDate } from './constants';

type Item = CalendarResult['items'][number];

export function CalendarClient({ admin, todayIso, variant = 'desktop' }: { admin: boolean; todayIso: string; variant?: 'desktop' | 'mobile' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ym, setYm] = useState<[number, number]>([Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1]);
  const [sel, setSel] = useState(todayIso);
  const [res, setRes] = useState<CalendarResult | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [typesOpen, setTypesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [floatRoom, setFloatRoom] = useState<{ id: string; name: string } | null>(null);

  const [y, m] = ym;
  useEffect(() => {
    let live = true;
    const { from, to } = monthRange(y, m);
    getCalendar({ from, to }).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [y, m]);

  const items = useMemo(() => (res?.items ?? []).filter((i) => !off.has(i.typeKey)), [res, off]);
  const byDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return map;
  }, [items]);
  const cells = useMemo(() => monthCells(y, m), [y, m]);
  const dayItems = byDate.get(sel) ?? [];

  if (!res) return <div className="py-16 text-center text-sm text-gray-400">Loading calendar…</div>;

  function move(delta: number) {
    let nm = m + delta,
      ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYm([ny, nm]);
  }
  function refresh() {
    const { from, to } = monthRange(y, m);
    getCalendar({ from, to }).then(setRes);
    router.refresh();
  }
  function act(fn: () => Promise<unknown>, msg?: string) {
    start(async () => {
      try {
        await fn();
        refresh();
        if (msg) toast(msg);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  const total = res.types.length;
  const onCount = total - res.types.filter((t) => off.has(t.key)).length;

  const grid = (
    <div className={cn('bg-white border border-gray-200 rounded-2xl overflow-hidden', variant === 'mobile' && 'text-[11px]')}>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="py-2 text-center text-[10.5px] font-semibold text-gray-400">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c) => {
          const evs = byDate.get(c.iso) ?? [];
          const risk = evs.some((e) => e.coverageNote);
          return (
            <button
              key={c.iso}
              onClick={() => { setSel(c.iso); }}
              className={cn('relative text-left border-r border-b border-gray-100 p-1.5 align-top', variant === 'desktop' ? 'min-h-[104px]' : 'min-h-[52px]', c.outside && 'bg-gray-50/60 opacity-60', c.iso === sel && 'ring-2 ring-brand ring-inset z-10')}
            >
              <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11.5px] font-semibold', c.iso === todayIso ? 'bg-brand text-white' : 'text-gray-700')}>{Number(c.iso.slice(8, 10))}</span>
              {risk && <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-status-red text-white text-[9px] font-bold flex items-center justify-center">!</span>}
              {variant === 'desktop' ? (
                <div className="mt-1 space-y-0.5">
                  {evs.slice(0, 3).map((e, i) => (
                    <div key={i} className="text-[10.5px] leading-tight px-1 py-0.5 rounded-r bg-gray-50 truncate" style={{ borderLeft: `2.5px solid ${e.colour}` }}>{e.icon} {e.title}</div>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] text-gray-400 font-semibold pl-1">+{evs.length - 3} more</div>}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {evs.slice(0, 4).map((e, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: e.colour }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const dayPanel = (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[14px] font-semibold text-gray-900">{longDate(sel)}</p>
          <p className="text-[11.5px] text-gray-500">{dayItems.length ? `${dayItems.length} item${dayItems.length > 1 ? 's' : ''}` : 'Nothing scheduled'}</p>
        </div>
        {admin && <Button size="sm" onClick={() => setAddOpen(true)}>Add</Button>}
      </div>
      {dayItems.length === 0 ? (
        <p className="text-center text-gray-400 text-[13px] py-8">Nothing on this day.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {dayItems.map((e, i) => (
            <div key={e.id ?? i} className="flex gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: `${e.colour}1f` }}>{e.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">
                  {e.title}
                  {e.status === 'pending' && <span className="ml-2 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-50 text-status-amber">Pending</span>}
                  {e.status === 'approved' && <span className="ml-2 text-[10px] font-bold rounded-full px-2 py-0.5 bg-green-50 text-status-green">Approved</span>}
                </p>
                {(e.timeLabel || e.detail) && <p className="text-[11.5px] text-gray-500 mt-0.5">{e.timeLabel ? <b>{e.timeLabel} · </b> : ''}{e.detail}</p>}
                {e.engine && <p className="text-[10.5px] text-gray-400 italic mt-1">Generated by the staffing engine</p>}
                {e.coverageNote && <p className="text-[11.5px] text-status-red bg-red-50 rounded-lg px-2.5 py-1.5 mt-1.5">⚠ {e.coverageNote}</p>}
                {admin && e.typeKey === 'timeoff' && e.status === 'pending' && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <button disabled={pending} onClick={() => act(() => decideTimeOff(e.id!, false), 'Denied')} className="text-[12px] font-semibold text-status-red border border-red-200 rounded-lg px-2.5 py-1">Deny</button>
                    {e.coverageRoomId && <button disabled={pending} onClick={() => setFloatRoom({ id: e.coverageRoomId!, name: e.coverageRoomName ?? 'Room' })} className="text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1">Find cover</button>}
                    <button disabled={pending} onClick={() => act(() => decideTimeOff(e.id!, true), 'Approved')} className="text-[12px] font-semibold text-white bg-status-green rounded-lg px-2.5 py-1">Approve</button>
                  </div>
                )}
                {admin && !e.derived && (
                  <button disabled={pending} onClick={() => act(() => deleteEvent(e.id!), 'Deleted')} className="text-[11px] text-gray-400 hover:text-status-red mt-1.5">Delete</button>
                )}
              </div>
              <span className="text-[9.5px] font-bold uppercase tracking-wide flex-shrink-0" style={{ color: e.colour }}>{e.typeLabel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={() => move(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
      <div className="text-[16px] font-semibold text-gray-900 min-w-[150px]">{MONTH_NAMES[m]} {y}</div>
      <button onClick={() => move(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
      <span className="flex-1" />
      <Button variant="secondary" size="sm" onClick={() => { setYm([Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1]); setSel(todayIso); }}>Today</Button>
      <Button variant="secondary" size="sm" onClick={() => setTypesOpen(true)}>Types · {onCount}/{total}</Button>
    </div>
  );

  return (
    <div>
      {variant === 'mobile' && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
          {(['month', 'agenda'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('flex-1 py-1.5 rounded-lg text-[13px] font-semibold capitalize', view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>{v}</button>
          ))}
        </div>
      )}

      {view === 'agenda' && variant === 'mobile' ? (
        <AgendaView items={items} />
      ) : variant === 'desktop' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-4 items-start">
          <div>{header}<div className="overflow-x-auto">{grid}</div></div>
          <div className="xl:sticky xl:top-0">{dayPanel}</div>
        </div>
      ) : (
        <div>
          {header}
          {grid}
          <div className="mt-3">{dayPanel}</div>
        </div>
      )}

      {/* Types sheet */}
      {typesOpen && res && (
        <TypesModal
          types={res.types}
          off={off}
          admin={admin}
          pending={pending}
          onToggle={(k) => setOff((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
          onAll={(show) => setOff(show ? new Set() : new Set(res.types.map((t) => t.key)))}
          onVis={(k, v) => act(() => setTypeVisibility(k, v), 'Updated')}
          onDelete={(k) => act(() => deleteType(k), 'Type deleted')}
          onCreate={(input) => act(() => createType(input), 'Type added')}
          onClose={() => setTypesOpen(false)}
        />
      )}

      {/* Add event */}
      {addOpen && res && admin && (
        <AddModal
          types={res.types}
          date={sel}
          pending={pending}
          onClose={() => setAddOpen(false)}
          onCreate={(input) => { act(() => createEvent(input), 'Added to the calendar'); setAddOpen(false); }}
        />
      )}

      <FloatSheet room={floatRoom} onClose={() => setFloatRoom(null)} />
    </div>
  );
}

function AgendaView({ items }: { items: Item[] }) {
  const days = [...new Set(items.map((i) => i.date))].sort();
  if (!days.length) return <p className="text-center text-gray-400 text-sm py-10">Nothing coming up.</p>;
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d}>
          <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{longDate(d)}</p>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
            {items.filter((i) => i.date === d).map((e, i) => (
              <div key={e.id ?? i} className="flex gap-3 px-3 py-2.5">
                <span className="text-[15px]">{e.icon}</span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{e.title}</p>{(e.timeLabel || e.detail) && <p className="text-[11px] text-gray-500">{e.timeLabel ? `${e.timeLabel} · ` : ''}{e.detail}</p>}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypesModal({ types, off, admin, pending, onToggle, onAll, onVis, onDelete, onCreate, onClose }: {
  types: CalType[]; off: Set<string>; admin: boolean; pending: boolean;
  onToggle: (k: string) => void; onAll: (show: boolean) => void; onVis: (k: string, v: boolean) => void; onDelete: (k: string) => void; onCreate: (i: { label: string; colour: string; icon: string; visibleStaff: boolean }) => void; onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(CAL_EMOJIS[0]!);
  const [colour, setColour] = useState(CAL_COLOURS[0]!);
  const [visStaff, setVisStaff] = useState(true);

  async function del(k: string, lbl: string) {
    const n = await countTypeEvents(k);
    if (n && !confirm(`${lbl} has ${n} event${n > 1 ? 's' : ''}. Delete the type and its events?`)) return;
    onDelete(k);
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Event types" size="md">
      <div className="space-y-1 max-h-[46vh] overflow-y-auto">
        {types.map((t) => (
          <div key={t.key} className="flex items-center gap-3 py-2">
            <button onClick={() => onToggle(t.key)} className={cn('w-5 h-5 rounded-md border flex items-center justify-center text-white text-[11px] flex-shrink-0', off.has(t.key) ? 'border-gray-300' : 'border-transparent')} style={{ background: off.has(t.key) ? undefined : t.colour }}>{off.has(t.key) ? '' : '✓'}</button>
            <span className="text-[15px]">{t.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-gray-900">{t.label}{!t.isSystem && <span className="ml-1.5 text-[10px] font-bold rounded px-1.5 py-0.5 bg-gray-100 text-gray-500">Custom</span>}</p>
              <p className="text-[10.5px] text-gray-400">{[t.visibleAdmin && 'Admins', t.visibleStaff && 'Staff', t.visibleFamily && 'Families'].filter(Boolean).join(' · ') || 'Nobody'}</p>
            </div>
            {admin && (
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 flex-shrink-0">
                <input type="checkbox" checked={t.visibleStaff} disabled={pending} onChange={(e) => onVis(t.key, e.target.checked)} className="accent-brand" /> staff
              </label>
            )}
            {admin && !t.isSystem && <button onClick={() => del(t.key, t.label)} className="text-[11px] text-gray-400 hover:text-status-red flex-shrink-0">Delete</button>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <Button variant="secondary" size="sm" onClick={() => onAll(true)}>Show all</Button>
        <Button variant="secondary" size="sm" onClick={() => onAll(false)}>Hide all</Button>
        {admin && <Button size="sm" className="ml-auto" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'New type'}</Button>}
      </div>
      {adding && admin && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <Label>Name</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Immunization due" />
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-1.5">{CAL_EMOJIS.map((e) => <button key={e} onClick={() => setIcon(e)} className={cn('w-8 h-8 rounded-lg border text-[16px]', icon === e ? 'border-brand bg-brand/5' : 'border-gray-200')}>{e}</button>)}</div>
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-1.5">{CAL_COLOURS.map((cc) => <button key={cc} onClick={() => setColour(cc)} className={cn('w-6 h-6 rounded-full', colour === cc && 'ring-2 ring-offset-1 ring-gray-900')} style={{ background: cc }} />)}</div>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-700 pt-1"><input type="checkbox" checked={visStaff} onChange={(e) => setVisStaff(e.target.checked)} className="accent-brand" /> Visible to staff</label>
          <Button className="w-full" disabled={pending || !label.trim()} onClick={() => { onCreate({ label, colour, icon, visibleStaff: visStaff }); setAdding(false); setLabel(''); }}>Create type</Button>
        </div>
      )}
    </Modal>
  );
}

function AddModal({ types, date, pending, onClose, onCreate }: { types: CalType[]; date: string; pending: boolean; onClose: () => void; onCreate: (i: { typeKey: string; title: string; detail?: string; startsOn: string; timeLabel?: string }) => void }) {
  const creatable = types.filter((t) => !t.isDerived);
  const [typeKey, setTypeKey] = useState(creatable[0]?.key ?? 'event');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Add to ${longDate(date)}`} size="md">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>{creatable.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</Select>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Field trip · Aquarium" autoFocus />
        <Label>Detail</Label>
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Which rooms, what families need to know" />
        <Label>Time (optional)</Label>
        <Input value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="9:30 AM" />
      </div>
      <Button className="w-full mt-4" disabled={pending || !title.trim()} onClick={() => onCreate({ typeKey, title, detail: detail || undefined, startsOn: date, timeLabel: timeLabel || undefined })}>Add to calendar</Button>
    </Modal>
  );
}
