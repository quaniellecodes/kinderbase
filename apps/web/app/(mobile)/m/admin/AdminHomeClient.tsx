'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, CalendarDays, Bell, Clock, Calendar, FileText, Star, MessageSquare } from 'lucide-react';
import { Card, StatusDot, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { enterRoomMode } from '../classroom/actions';
import { applyAgeMixFix } from './actions';
import { nudgeStaff } from '@/app/(dashboard)/dashboard/actions';
import { RoomModeSheet } from './RoomModeSheet';
import { FloatSheet } from './FloatSheet';
import type { AdminHome, AdminRoom, HeadsUp, ApprovalLite, StaffTodayRow } from './actions';

const dot: Record<AdminRoom['status'], 'green' | 'amber' | 'red'> = { ok: 'green', at_minimum: 'amber', out: 'red' };
const ratioColor: Record<AdminRoom['status'], string> = { ok: 'text-status-green', at_minimum: 'text-status-amber', out: 'text-status-red' };
const toneBadge: Record<string, string> = { red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-800', green: 'bg-green-50 text-green-800', gray: 'bg-gray-100 text-gray-500' };
const AV_PALETTE = ['#D35400', '#185FA5', '#0F6E56', '#7B4FBB', '#993C1D', '#534AB7', '#1D9E75', '#854F0B'];
const avColor = (s: string) => AV_PALETTE[(s.charCodeAt(0) + (s.charCodeAt(1) || 0)) % AV_PALETTE.length];
const centerInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();

const APPROVAL_ICON: Record<ApprovalLite['kind'], { icon: typeof Clock; bg: string; fg: string; label: string }> = {
  time: { icon: Clock, bg: 'bg-green-50', fg: 'text-status-green', label: 'Time correction' },
  leave: { icon: Calendar, bg: 'bg-amber-50', fg: 'text-status-amber', label: 'Leave' },
  sched: { icon: Calendar, bg: 'bg-blue-50', fg: 'text-blue-600', label: 'Schedule change' },
  plan: { icon: FileText, bg: 'bg-indigo-50', fg: 'text-indigo-600', label: 'Lesson plan' },
};

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
  function nudge(userId: string) {
    start(async () => {
      await nudgeStaff(userId);
      router.refresh();
      toast('Nudge sent — it lands in their Priorities');
    });
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{centerInitials(data.centerName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <h1 className="text-[15px] font-semibold text-gray-900 truncate min-w-0">{data.centerName}</h1>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </div>
          <p className="text-[11px] text-gray-500 truncate">{data.roleLabel} · {data.licensed} licensed</p>
        </div>
        <Link href="/m/calendar" aria-label="Calendar" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
          <CalendarDays className="w-4 h-4" />
        </Link>
        <Link href="/m/admin/inbox" aria-label="Inbox" className="relative w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
          <Bell className="w-4 h-4" />
          {data.approvals > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-status-red border border-white" />}
        </Link>
      </div>

      {/* Compliance alert */}
      {data.alert ? (
        <Card className="border-red-200 bg-red-50/40">
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-lg bg-status-red flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-white" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-red-800">{data.alert.name} out of compliance</p>
              <p className="text-[12px] text-red-700 mt-0.5">
                {data.alert.mixText} · {data.alert.citation.replace('COMAR 13A.16.08.03', 'COMAR')} requires {data.alert.required} staff, {data.alert.present} present.
                {data.alert.missingLead ? ' No lead teacher on the floor.' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setFloatRoom({ id: data.alert!.roomId, name: data.alert!.name })} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-status-red text-white">Assign float</button>
            <button onClick={() => cover(data.alert!.roomId)} disabled={pending} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white text-red-600 border border-red-200">Cover it myself</button>
            {data.alert.ageFix && <button onClick={() => ageMix(data.alert!.roomId)} disabled={pending} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white text-red-600 border border-red-200">Age-mix fix</button>}
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
        <Stat value={data.stats.staffOnFloor} denom={data.stats.staffScheduled} label="Staff on floor" />
        <Stat value={data.stats.children} denom={data.stats.childrenEnrolled} label="Children" />
        <Stat value={data.stats.compliant} denom={data.stats.roomsTotal} label="Compliant" tone={data.stats.compliant < data.stats.roomsTotal ? 'red' : 'green'} />
      </div>

      {/* Needs your approval */}
      {data.approvalsTop.length > 0 && (
        <section>
          <SectionHead title="Needs your approval" right={<Link href="/m/admin/inbox" className="text-[11px] font-semibold text-brand">{data.approvals} waiting</Link>} />
          <Card padding="none" className="divide-y divide-gray-50">
            {data.approvalsTop.map((a) => {
              const I = APPROVAL_ICON[a.kind];
              return (
                <Link key={a.id} href="/m/admin/inbox" className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', I.bg)}><I.icon className={cn('w-4 h-4', I.fg)} /></span>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-gray-900 truncate">{I.label} · {a.who}</p><p className="text-[11px] text-gray-500 truncate">{a.detail}</p></div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
              );
            })}
          </Card>
        </section>
      )}

      {/* Rooms right now */}
      <section>
        <SectionHead title="Rooms right now" right={<Link href="/m/admin/rooms" className="text-[11px] font-semibold text-brand">All</Link>} />
        <Card padding="none" className="divide-y divide-gray-50">
          {data.rooms.map((r) => (
            <button key={r.id} onClick={() => setModeRoom({ id: r.id, name: r.name })} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <StatusDot tone={dot[r.status]} />
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{r.name}</p><p className="text-[11px] text-gray-400 truncate">{r.staffNames} · {r.children} children</p></div>
              <div className="text-right flex-shrink-0"><div className={cn('text-[13px] font-semibold', ratioColor[r.status])}>{r.ratio}</div><div className="text-[10px] text-gray-400">needs {r.required}</div></div>
            </button>
          ))}
        </Card>
      </section>

      {/* Heads up */}
      {data.headsUp.length > 0 && (
        <section>
          <SectionHead title="Heads up" />
          <Card padding="none" className="divide-y divide-gray-50">
            {data.headsUp.map((h) => <HeadRow key={h.key} h={h} pending={pending} onNudge={nudge} />)}
          </Card>
        </section>
      )}

      {/* Staff today */}
      {data.staffToday.length > 0 && (
        <section>
          <SectionHead title="Staff today" />
          <Card padding="none" className="divide-y divide-gray-50">
            {data.staffToday.map((s) => <StaffRow key={s.key} s={s} />)}
          </Card>
        </section>
      )}

      <RoomModeSheet room={modeRoom} onClose={() => setModeRoom(null)} />
      <FloatSheet room={floatRoom} onClose={() => setFloatRoom(null)} />
    </div>
  );
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      {right}
    </div>
  );
}

function Stat({ value, denom, label, tone }: { value: number; denom?: number; label: string; tone?: 'green' | 'red' }) {
  return (
    <div className="bg-white py-3 text-center">
      <div className="text-lg font-semibold">
        <span className={cn(tone === 'red' ? 'text-status-red' : tone === 'green' ? 'text-status-green' : 'text-gray-900')}>{value}</span>
        {denom != null && <span className="text-[13px] text-gray-400 font-medium">/{denom}</span>}
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function HeadIcon({ h }: { h: HeadsUp }) {
  if (h.avatar) return <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ background: avColor(h.avatar) }}>{h.avatar}</span>;
  const map: Record<string, { Icon: typeof Star; bg: string; fg: string }> = {
    cred: { Icon: Star, bg: 'bg-red-50', fg: 'text-status-red' },
    docs: { Icon: FileText, bg: 'bg-amber-50', fg: 'text-status-amber' },
    aging: { Icon: MessageSquare, bg: 'bg-red-50', fg: 'text-status-red' },
  };
  const m = map[h.key] ?? { Icon: Star, bg: 'bg-gray-100', fg: 'text-gray-400' };
  return <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', m.bg)}><m.Icon className={cn('w-4 h-4', m.fg)} /></span>;
}

function HeadRow({ h, pending, onNudge }: { h: HeadsUp; pending: boolean; onNudge: (id: string) => void }) {
  const inner = (
    <>
      <HeadIcon h={h} />
      <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{h.title}</p><p className="text-[11px] text-gray-500">{h.sub}</p></div>
      {h.nudgeUserId ? (
        <button onClick={(e) => { e.preventDefault(); onNudge(h.nudgeUserId!); }} disabled={pending} className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-red-50 text-status-red flex-shrink-0">Nudge</button>
      ) : (
        h.badge && <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5 flex-shrink-0', toneBadge[h.tone])}>{h.badge}</span>
      )}
    </>
  );
  return h.href ? <Link href={h.href} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">{inner}</Link> : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>;
}

function StaffRow({ s }: { s: StaffTodayRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ background: avColor(s.name) }}>{s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
      <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{s.name}</p><p className="text-[11px] text-gray-500 truncate">{s.sub}</p></div>
      {s.badge && <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5 flex-shrink-0', toneBadge[s.tone === 'amber' ? 'amber' : s.tone === 'ok' ? 'green' : 'gray'])}>{s.badge}</span>}
    </div>
  );
}
