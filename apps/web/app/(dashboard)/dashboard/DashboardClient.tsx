'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, GripVertical, Lock, Plus } from 'lucide-react';
import { Card, Button, StatCard, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { FloatSheet } from '@/app/(mobile)/m/admin/FloatSheet';
import { applyAgeMixFix } from '@/app/(mobile)/m/admin/actions';
import { resolveApproval } from '@/app/(mobile)/m/admin/approvals-actions';
import { WIDGET_BY_KEY, WIDGETS, type WidgetKey, type WidgetLayoutRow } from './widgets';
import { saveDashboardLayout, nudgeStaff, type DirectorDashboard } from './actions';

const statusEdge: Record<string, string> = { ok: 'border-l-status-green', at_minimum: 'border-l-status-amber', out: 'border-l-status-red' };
const toneText: Record<string, string> = { ok: 'text-status-green', amber: 'text-status-amber', red: 'text-status-red', gray: 'text-gray-400' };
const toneBg: Record<string, string> = { red: 'bg-red-50 text-status-red', amber: 'bg-amber-50 text-status-amber', green: 'bg-green-50 text-status-green', gray: 'bg-gray-100 text-gray-500' };

function relTime(iso: string): string {
  if (!iso) return '';
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function DashboardClient({ data, initialLayout }: { data: DirectorDashboard; initialLayout: WidgetLayoutRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [layout, setLayout] = useState<WidgetLayoutRow[]>(initialLayout);
  const [edit, setEdit] = useState(false);
  const [floatRoom, setFloatRoom] = useState<{ id: string; name: string } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const visible = layout.filter((l) => l.visible).sort((a, b) => a.sort_order - b.sort_order);
  const hidden = WIDGETS.filter((w) => !layout.some((l) => l.widget_key === w.key && l.visible));

  function persist(next: WidgetLayoutRow[]) {
    setLayout(next);
    start(async () => {
      await saveDashboardLayout(next);
    });
  }
  function setSpan(key: WidgetKey, span: number) {
    persist(layout.map((l) => (l.widget_key === key ? { ...l, span } : l)));
  }
  function hide(key: WidgetKey) {
    persist(layout.map((l) => (l.widget_key === key ? { ...l, visible: false } : l)));
    toast(`${WIDGET_BY_KEY[key].title} hidden`);
  }
  function show(key: WidgetKey) {
    const def = WIDGET_BY_KEY[key];
    const maxOrder = Math.max(0, ...layout.map((l) => l.sort_order));
    const existing = layout.find((l) => l.widget_key === key);
    const next = existing
      ? layout.map((l) => (l.widget_key === key ? { ...l, visible: true, sort_order: maxOrder + 1 } : l))
      : [...layout, { widget_key: key, sort_order: maxOrder + 1, span: def.defaultSpan, visible: true }];
    persist(next);
  }
  function reset() {
    persist(WIDGETS.filter((w) => w.defaultOn).map((w, i) => ({ widget_key: w.key, sort_order: i, span: w.defaultSpan, visible: true })));
    toast('Reset to the default layout');
  }
  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const order = visible.map((l) => l.widget_key);
    const from = order.indexOf(dragKey as WidgetKey);
    const to = order.indexOf(targetKey as WidgetKey);
    order.splice(to, 0, ...order.splice(from, 1));
    const reordered = layout.map((l) => (l.visible ? { ...l, sort_order: order.indexOf(l.widget_key) } : l));
    setDragKey(null);
    persist(reordered);
  }

  function act(fn: () => Promise<unknown>, msg?: string) {
    start(async () => {
      await fn();
      router.refresh();
      if (msg) toast(msg);
    });
  }

  return (
    <div className="max-w-[1300px] mx-auto w-full">
      {/* Locked compliance banner */}
      <Banner data={data} onFloat={setFloatRoom} onFix={() => act(() => applyAgeMixFix(data.banner!.roomId), 'Children moved')} pending={pending} />

      {/* Lock note / customise toggle */}
      {edit ? (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-2.5 mb-4 text-[13px]">
          <b className="font-semibold">Arranging your dashboard</b>
          <span className="text-indigo-500">Drag a header to reorder · use 1/2/3 to set width</span>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" onClick={reset}>Reset</Button>
          <Button size="sm" onClick={() => setEdit(false)}>Done</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-gray-400 mb-4">
          <Lock className="w-3.5 h-3.5" />
          <span>The compliance banner always stays at the top — everything below is yours to arrange.</span>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => setEdit(true)}>Customise</Button>
        </div>
      )}

      {/* Hidden tray */}
      {edit && hidden.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 mb-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Hidden — click to add back</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((w) => (
              <button key={w.key} onClick={() => show(w.key)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:border-brand hover:text-brand">
                <Plus className="w-3 h-3" /> {w.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {visible.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm border border-dashed border-gray-300 rounded-xl py-10">Every widget is hidden. Add one back from the tray above.</div>}
        {visible.map((l) => {
          const def = WIDGET_BY_KEY[l.widget_key];
          const span = Math.min(3, Math.max(1, l.span));
          return (
            <div
              key={l.widget_key}
              draggable={edit}
              onDragStart={() => setDragKey(l.widget_key)}
              onDragOver={(e) => edit && e.preventDefault()}
              onDrop={() => onDrop(l.widget_key)}
              className={cn(span === 3 ? 'md:col-span-2 xl:col-span-3' : span === 2 ? 'md:col-span-2 xl:col-span-2' : '', edit && dragKey === l.widget_key && 'opacity-40')}
            >
              <WidgetShell def={def} edit={edit} span={span} onSpan={(s) => setSpan(l.widget_key, s)} onHide={() => hide(l.widget_key)}>
                <WidgetBody keyName={l.widget_key} data={data} onFloat={setFloatRoom} act={act} pending={pending} />
              </WidgetShell>
            </div>
          );
        })}
      </div>

      <FloatSheet room={floatRoom} onClose={() => setFloatRoom(null)} />
    </div>
  );
}

function Banner({ data, onFloat, onFix, pending }: { data: DirectorDashboard; onFloat: (r: { id: string; name: string }) => void; onFix: () => void; pending: boolean }) {
  if (!data.banner) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-status-green flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-white" /></div>
        <div><p className="text-[13px] font-semibold text-green-800">All rooms in compliance</p><p className="text-[12px] text-green-700">Ratio, group size, age mix, and lead teacher all check out.</p></div>
      </div>
    );
  }
  const b = data.banner;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3.5 mb-4 flex-wrap">
      <div className="w-8 h-8 rounded-lg bg-status-red flex items-center justify-center flex-shrink-0"><AlertCircle className="w-5 h-5 text-white" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-red-800">{b.name} out of compliance{data.moreOut > 0 ? ` · ${data.moreOut} more room${data.moreOut > 1 ? 's' : ''}` : ''}</p>
        <p className="text-[12px] text-red-700">{b.mixText} · {b.citation} requires {b.required} staff, {b.present} present.{b.missingLead ? ' No lead teacher on the floor.' : ''}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button variant="danger" size="sm" onClick={() => onFloat({ id: b.roomId, name: b.name })}>Assign float</Button>
        {b.ageFix && <Button variant="secondary" size="sm" disabled={pending} onClick={onFix}>Age-mix fix</Button>}
        <Link href={`/classrooms/${b.roomId}`}><Button variant="secondary" size="sm">Open room</Button></Link>
      </div>
    </div>
  );
}

function WidgetShell({ def, edit, span, onSpan, onHide, children }: { def: (typeof WIDGETS)[number]; edit: boolean; span: number; onSpan: (s: number) => void; onHide: () => void; children: React.ReactNode }) {
  const header = (
    <div className={cn('flex items-center gap-2', def.bare && !edit ? 'hidden' : 'px-4 py-3 border-b border-gray-100', def.bare && edit && 'border border-dashed border-gray-300 rounded-lg mb-2 bg-white')}>
      {edit && <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />}
      <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-gray-900">{def.title}</p><p className="text-[11px] text-gray-400">{def.sub}</p></div>
      {edit && (
        <>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => onSpan(n)} className={cn('w-6 h-5 rounded text-[11px] font-bold', span === n ? 'bg-brand text-white' : 'text-gray-500')}>{n}</button>
            ))}
          </div>
          <button onClick={onHide} className="text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:border-status-red hover:text-status-red">Hide</button>
        </>
      )}
    </div>
  );
  if (def.bare) return <div>{header}{children}</div>;
  return <Card padding="none" className="overflow-hidden">{header}{children}</Card>;
}

function WidgetBody({ keyName, data, onFloat, act, pending }: { keyName: WidgetKey; data: DirectorDashboard; onFloat: (r: { id: string; name: string }) => void; act: (fn: () => Promise<unknown>, msg?: string) => void; pending: boolean }) {
  const sectionEmpty = (t: string) => <p className="text-center text-gray-400 text-[13px] py-8">{t}</p>;

  switch (keyName) {
    case 'strip':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {data.strip.map((r) => (
            <Link key={r.id} href={`/classrooms/${r.id}`} className={cn('rounded-xl border border-gray-200 border-l-[3px] bg-white p-3 hover:shadow-sm', statusEdge[r.status])}>
              <p className="text-[12px] font-semibold text-gray-900 truncate">{r.name}</p>
              <p className="text-xl font-semibold text-gray-900 mt-1.5">{r.ratio}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{r.present} of {r.required} staff · {r.children} children</p>
              {r.status === 'out' && <p className="text-[10px] font-bold text-status-red mt-1">Out of ratio</p>}
            </Link>
          ))}
        </div>
      );
    case 'kpi': {
      const k = data.kpi;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Staff on floor" value={`${k.staffOnFloor}`} sub={`of ${k.staffScheduled} scheduled`} />
          <StatCard label="Children present" value={`${k.children}`} sub={`of ${k.childrenEnrolled} enrolled`} />
          <StatCard label="Rooms compliant" value={`${k.compliant}/${k.roomsTotal}`} tone={k.compliant === k.roomsTotal ? 'green' : 'red'} />
          <StatCard label="Approvals" value={`${k.approvals}`} />
          <StatCard label="Unanswered families" value={`${k.unanswered}`} tone={k.unanswered ? 'red' : 'green'} />
        </div>
      );
    }
    case 'needs':
      if (!data.needs.length) return sectionEmpty('Nothing waiting on you 🎉');
      return (
        <div className="divide-y divide-gray-50">
          {data.needs.map((n) => (
            <div key={n.key} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', n.urgency === 0 ? 'bg-status-red' : n.urgency === 1 ? 'bg-status-amber' : 'bg-status-blue')} />
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{n.title}</p><p className="text-[11px] text-gray-500 truncate">{n.sub}</p></div>
              <div className="flex gap-1.5 flex-shrink-0">
                {n.kind === 'approval' && !n.plan && <><button disabled={pending} onClick={() => act(() => resolveApproval(n.refId!, 'rejected'), 'Denied')} className="text-[12px] font-semibold text-status-red border border-red-200 rounded-lg px-2.5 py-1">Deny</button><button disabled={pending} onClick={() => act(() => resolveApproval(n.refId!, 'approved'), 'Approved')} className="text-[12px] font-semibold text-white bg-status-green rounded-lg px-2.5 py-1">Approve</button></>}
                {n.kind === 'approval' && n.plan && <button disabled={pending} onClick={() => act(() => resolveApproval(n.refId!, 'approved'), 'Plan approved')} className="text-[12px] font-semibold text-white bg-status-green rounded-lg px-2.5 py-1">Approve</button>}
                {n.kind === 'aging' && n.href && <Link href={n.href} className="text-[12px] font-semibold text-brand border border-gray-200 rounded-lg px-2.5 py-1">Open</Link>}
                {n.kind === 'late' && <button disabled={pending} onClick={() => act(() => nudgeStaff(n.refId!), 'Nudge sent')} className="text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1">Nudge</button>}
              </div>
            </div>
          ))}
        </div>
      );
    case 'rooms':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"><th className="px-4 py-2">Room</th><th className="px-2 py-2">Governing rule</th><th className="px-2 py-2">Staff</th><th className="px-2 py-2">Lead</th><th className="px-4 py-2">Status</th></tr></thead>
            <tbody>
              {data.strip.map((r) => (
                <tr key={r.id} className={cn('border-b border-gray-50', r.status === 'out' && 'bg-red-50/40')}>
                  <td className="px-4 py-2.5"><p className="font-semibold text-gray-900">{r.name}</p><p className="text-[10.5px] text-gray-400">{r.mixText}</p></td>
                  <td className="px-2 py-2.5">{r.ruleName}<p className="text-[10.5px] text-gray-400">{r.citation}</p></td>
                  <td className="px-2 py-2.5"><b className={cn(r.present < r.required && 'text-status-red')}>{r.present}</b> / {r.required}</td>
                  <td className="px-2 py-2.5">{r.leadOk ? '✓' : <span className="text-status-red font-bold">✕</span>}</td>
                  <td className="px-4 py-2.5"><span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5', r.status === 'out' ? toneBg.red : r.status === 'at_minimum' ? toneBg.amber : toneBg.green)}>{r.ratio}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'heads':
      if (!data.heads.length) return sectionEmpty('Nothing on the horizon.');
      return (
        <div className="divide-y divide-gray-50">
          {data.heads.map((h) => (
            <div key={h.key} className="flex items-center gap-3 px-4 py-3"><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{h.title}</p><p className="text-[11px] text-gray-500">{h.sub}</p></div>{h.badge && <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5', toneBg[h.tone])}>{h.badge}</span>}</div>
          ))}
        </div>
      );
    case 'acc':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"><th className="px-4 py-2">Teacher</th><th className="px-2 py-2">Posts · 7d</th><th className="px-2 py-2">Last posted</th><th className="px-4 py-2"></th></tr></thead>
            <tbody>
              {data.acc.map((a) => (
                <tr key={a.userId} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{a.name}</td>
                  <td className={cn('px-2 py-2.5 font-semibold', toneText[a.tone])}>{a.posts7d}</td>
                  <td className="px-2 py-2.5 text-gray-500">{a.last ? relTime(a.last) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">{a.tone === 'red' && <button disabled={pending} onClick={() => act(() => nudgeStaff(a.userId), 'Nudge sent')} className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1">Nudge</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'staff':
      if (!data.staff.length) return sectionEmpty('Everyone accounted for.');
      return (
        <div className="divide-y divide-gray-50">
          {data.staff.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3"><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{s.name}</p><p className="text-[11px] text-gray-500">{s.sub}</p></div>{s.badge && <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5', toneBg[s.tone === 'amber' ? 'amber' : 'gray'])}>{s.badge}</span>}</div>
          ))}
        </div>
      );
    case 'approv':
      if (!data.approvals.length) return sectionEmpty('Inbox zero.');
      return (
        <div className="divide-y divide-gray-50">
          {data.approvals.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <p className="text-[12px] font-semibold text-gray-900">{a.who} · {a.title}</p>
              <p className="text-[11px] text-gray-500 mb-2">{a.detail}</p>
              <div className="flex gap-1.5">
                <button disabled={pending} onClick={() => act(() => resolveApproval(a.id, 'rejected'), 'Denied')} className="text-[12px] font-semibold text-status-red border border-red-200 rounded-lg px-2.5 py-1">{a.kind === 'plan' ? 'Return' : 'Deny'}</button>
                <button disabled={pending} onClick={() => act(() => resolveApproval(a.id, 'approved'), 'Approved')} className="text-[12px] font-semibold text-white bg-status-green rounded-lg px-2.5 py-1">Approve</button>
              </div>
            </div>
          ))}
        </div>
      );
    case 'feed':
      if (!data.feed.length) return sectionEmpty('No updates yet.');
      return (
        <div className="divide-y divide-gray-50">
          {data.feed.map((f) => (
            <div key={f.id} className="px-4 py-3"><p className="text-[11px] text-gray-400">{f.author} · {f.room} · {relTime(f.at)}</p><p className="text-[12.5px] text-gray-800 mt-0.5">{f.body}</p></div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
