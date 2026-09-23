'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Card, StatusDot, toast, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { enterRoomMode } from '../classroom/actions';
import { applyAgeMixFix } from './actions';
import { RoomModeSheet } from './RoomModeSheet';
import { FloatSheet } from './FloatSheet';
import type { AdminHome, AdminRoom } from './actions';

const ratioColor: Record<AdminRoom['status'], string> = { ok: 'text-status-green', at_minimum: 'text-status-amber', out: 'text-status-red' };
const dot: Record<AdminRoom['status'], 'green' | 'amber' | 'red'> = { ok: 'green', at_minimum: 'amber', out: 'red' };
const toneBg: Record<string, string> = { red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-800', green: 'bg-green-50 text-green-800' };

export function AdminHomeClient({ data }: { data: AdminHome }) {
  const router = useRouter();
  const [modeRoom, setModeRoom] = useState<{ id: string; name: string } | null>(null);
  const [floatRoom, setFloatRoom] = useState<{ id: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  function cover(roomId: string) {
    start(async () => {
      await enterRoomMode(roomId, 'cover');
      router.push(`/m/classroom/${roomId}`);
    });
  }
  function ageMix(roomId: string) {
    start(async () => {
      const res = await applyAgeMixFix(roomId);
      router.refresh();
      toast(res ? `Moved ${res.moved.map((n) => n.split(' ')[0]).join(' & ')} → ${res.to}` : 'No age-mix fix available');
    });
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{data.centerName}</h1>
        <p className="text-xs text-gray-500">Live compliance across every room</p>
      </div>

      {/* Compliance alert */}
      {data.alert ? (
        <Card className="border-red-200 bg-red-50/40">
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-lg bg-status-red flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-white" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-red-800">{data.alert.name} out of compliance</p>
              <p className="text-[12px] text-red-700 mt-0.5">
                {data.alert.mixText} · {data.alert.citation.replace('COMAR 13A.16.08.03', 'COMAR')} needs {data.alert.required} staff, {data.alert.present} present.
                {data.alert.missingLead ? ' No lead teacher on the floor.' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setFloatRoom({ id: data.alert!.roomId, name: data.alert!.name })} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-status-red text-white">Assign float</button>
            <button onClick={() => cover(data.alert!.roomId)} disabled={pending} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white text-red-600 border border-red-200">Cover it myself</button>
            {data.alert.ageFix && (
              <button onClick={() => ageMix(data.alert!.roomId)} disabled={pending} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white text-red-600 border border-red-200">Move {data.alert.ageFix.names.map((n) => n.split(' ')[0]).join(' & ')}</button>
            )}
          </div>
          {data.moreOut > 0 && <p className="text-[11px] text-gray-500 mt-2">{data.moreOut} more room{data.moreOut > 1 ? 's' : ''} also need attention.</p>}
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50/40">
          <div className="flex gap-3 items-center">
            <span className="w-8 h-8 rounded-lg bg-status-green flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4 text-white" /></span>
            <div><p className="text-[13px] font-semibold text-green-800">All rooms in compliance</p><p className="text-[12px] text-green-700">Ratio, group size, age mix, and lead all check out.</p></div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 rounded-card overflow-hidden border border-gray-100">
        <Stat value={String(data.stats.staffOnFloor)} label="Staff on floor" />
        <Stat value={String(data.stats.children)} label="Children" />
        <Stat value={`${data.stats.compliant}/${data.stats.roomsTotal}`} label="Compliant" tone={data.stats.compliant < data.stats.roomsTotal ? 'red' : 'green'} />
      </div>

      {/* Approvals */}
      <Link href="/m/admin/inbox" className="block">
        <Card className="flex items-center gap-3">
          <div className="flex-1"><p className="text-[13px] font-semibold text-gray-900">Needs your approval</p><p className="text-[11px] text-gray-500">Time, leave, schedule, lesson plans</p></div>
          {data.approvals > 0 && <span className="text-[11px] font-bold bg-red-100 text-red-600 rounded-full px-2 py-0.5">{data.approvals}</span>}
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </Card>
      </Link>

      {/* Rooms right now */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rooms right now</p>
          <Link href="/m/admin/rooms" className="text-[11px] font-semibold text-brand">All</Link>
        </div>
        <Card padding="none" className="divide-y divide-gray-50">
          {data.rooms.map((r) => (
            <button key={r.id} onClick={() => setModeRoom({ id: r.id, name: r.name })} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <StatusDot tone={dot[r.status]} />
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{r.name}</p><p className="text-[11px] text-gray-400 truncate">{r.mixText}</p></div>
              <div className="text-right flex-shrink-0"><div className={cn('text-[13px] font-semibold', ratioColor[r.status])}>{r.ratio}</div><div className="text-[10px] text-gray-400">needs {r.required}</div></div>
            </button>
          ))}
        </Card>
      </section>

      {/* Heads up */}
      {data.headsUp.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Heads up</p>
          <Card padding="none" className="divide-y divide-gray-50">
            {data.headsUp.map((h) => {
              const inner = (
                <>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{h.title}</p><p className="text-[11px] text-gray-500">{h.sub}</p></div>
                  <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5', toneBg[h.tone])}>{h.badge}</span>
                </>
              );
              return h.href ? (
                <Link key={h.key} href={h.href} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">{inner}</Link>
              ) : (
                <div key={h.key} className="flex items-center gap-3 px-4 py-3">{inner}</div>
              );
            })}
          </Card>
        </section>
      )}

      <RoomModeSheet room={modeRoom} onClose={() => setModeRoom(null)} />
      <FloatSheet room={floatRoom} onClose={() => setFloatRoom(null)} />
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'green' | 'red' }) {
  return (
    <div className="bg-white py-3 text-center">
      <div className={cn('text-lg font-semibold', tone === 'red' ? 'text-status-red' : tone === 'green' ? 'text-status-green' : 'text-gray-900')}>{value}</div>
      <div className="text-[9px] text-gray-400">{label}</div>
    </div>
  );
}
