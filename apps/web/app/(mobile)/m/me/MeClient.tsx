'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, Award, GraduationCap, Clock, FileText, ChevronRight } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Card, Avatar, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MeData, Signal } from './actions';

function Stars({ v, size = 'text-sm' }: { v: number; size?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', size)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(v) ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  );
}
function Bar({ s }: { s: Signal }) {
  const low = s.value < 3.5;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[11px] text-gray-600 w-24 flex-shrink-0">{s.label}</span>
      <span className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <span className={cn('block h-full rounded-full', low ? 'bg-status-amber' : 'bg-status-green')} style={{ width: `${(s.value / 5) * 100}%` }} />
      </span>
      <span className={cn('text-[11px] font-semibold w-7 text-right', low ? 'text-status-amber' : 'text-status-green')}>{s.value.toFixed(1)}</span>
    </div>
  );
}
const stateColor: Record<string, string> = { full: 'bg-blue-50 border-blue-200', am: 'bg-blue-50/60 border-blue-100', pm: 'bg-blue-50/60 border-blue-100', none: 'bg-gray-50 border-gray-100' };

export function MeClient({ data }: { data: MeData }) {
  const [growth, setGrowth] = useState(false);

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-14 bg-gradient-to-br from-brand to-[#2a2a28]" />
        <div className="px-4 -mt-7">
          <div className="border-[3px] border-white rounded-full w-fit"><Avatar name={data.name} size="lg" /></div>
          <p className="text-[17px] font-semibold text-gray-900 mt-1.5">{data.name}</p>
          <p className="text-xs text-gray-500 capitalize">{data.role.replace('_', ' ')} · {data.centerName}</p>
          <button onClick={() => setGrowth(true)} className="inline-flex items-center gap-2 mt-2 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
            <Stars v={data.score} size="text-xs" /><span className="text-[13px] font-semibold">{data.score.toFixed(1)}</span>
          </button>
          {data.sinceYear && <span className="ml-2 text-[10px] text-gray-400">Since {data.sinceYear}</span>}
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-100 mt-3 border-y border-gray-100">
          <Stat value={data.attendance.toFixed(1)} label="Attendance" tone="green" />
          <Stat value={data.tenureYears != null ? `${data.tenureYears}y` : '—'} label="Tenure" />
          <Stat value={String(data.expiring)} label="Expiring" tone={data.expiring ? 'amber' : 'green'} />
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Growth */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">My growth</p>
            <button onClick={() => setGrowth(true)} className="text-[11px] font-semibold text-brand">Breakdown</button>
          </div>
          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div>
                <div className="text-2xl font-semibold leading-none">{data.score.toFixed(1)}</div>
                <Stars v={data.score} size="text-[11px]" />
              </div>
              <p className="text-[11px] text-gray-500 flex-1">{data.isFloat ? 'Measured per hour on the floor · updated nightly' : 'Updated nightly · 30-day delayed view'}</p>
            </div>
            <div className="border-t border-gray-50 pt-1">
              {data.signals.map((s) => <Bar key={s.label} s={s} />)}
            </div>
            <div className="mt-2 rounded-lg bg-amber-50 text-amber-800 text-[12px] px-3 py-2"><b>Closest win:</b> {data.closestWin}</div>
          </Card>
        </section>

        {/* Schedule */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Schedule</p>
            <button onClick={() => toast('Request a schedule update — goes to your director')} className="text-[11px] font-semibold text-brand">Request update</button>
          </div>
          <Card>
            <div className="flex gap-1.5">
              {data.week.map((d, i) => (
                <div key={i} className={cn('flex-1 rounded-lg py-2 text-center border', d.today ? 'bg-brand border-brand' : stateColor[d.state] ?? 'bg-gray-50 border-gray-100')}>
                  <div className={cn('text-[11px] font-bold', d.today ? 'text-white' : 'text-gray-600')}>{d.label}</div>
                  <div className={cn('text-[8px] mt-0.5', d.today ? 'text-white/80' : 'text-gray-400')}>{d.state === 'none' ? 'off' : d.state === 'full' ? 'full' : d.state}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
              <Leave v={data.leave.sick} label="Sick" />
              <Leave v={data.leave.vacation} label="Vacation" />
              <Leave v={data.leave.personal} label="Personal" />
            </div>
          </Card>
        </section>

        {/* Employment */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Employment</p>
          <Card padding="none" className="divide-y divide-gray-50">
            <EmpRow href={`/staff/${data.userId}`} icon={<Globe className="w-4 h-4 text-emerald-700" />} bg="bg-emerald-50" title="Full profile & public page" sub="Credentials you can share with other centers" />
            <EmpRow onClick={() => toast('Credentials portfolio')} icon={<Award className="w-4 h-4 text-amber-600" />} bg="bg-amber-50" title="Credentials" sub={`${data.expiring} expiring soon`} />
            <EmpRow onClick={() => toast('Training hours · Maryland Core of Knowledge')} icon={<GraduationCap className="w-4 h-4 text-indigo-600" />} bg="bg-indigo-50" title="Training hours" sub="Maryland COK domains" />
            <EmpRow onClick={() => toast('Time & pay period')} icon={<Clock className="w-4 h-4 text-emerald-700" />} bg="bg-emerald-50" title="Time & hours" sub="This pay period" />
            <EmpRow onClick={() => toast('Time off · schedule changes · corrections')} icon={<FileText className="w-4 h-4 text-blue-600" />} bg="bg-blue-50" title="Requests" sub="Time off, schedule changes, corrections" />
          </Card>
        </section>

        {/* Coaching */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Coaching</p>
          <Card padding="compact"><p className="text-[12px] text-gray-400">No active coaching cycle. Your instructional lead schedules these with you.</p></Card>
        </section>
      </div>

      {/* Growth sheet */}
      <BottomSheet open={growth} onClose={() => setGrowth(false)} title={`How your ${data.score.toFixed(1)} is calculated`}>
        <p className="text-[12px] text-gray-500 mb-3">Updated nightly. Only you and your director can see this.</p>
        <div className="space-y-0.5">
          {data.signals.map((s) => (
            <div key={s.label} className="flex items-center gap-2 py-1.5">
              <span className="text-[12px] text-gray-700 flex-1">{s.label} <span className="text-gray-400">· {s.weight}%</span></span>
              <span className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden"><span className={cn('block h-full rounded-full', s.value < 3.5 ? 'bg-status-amber' : 'bg-status-green')} style={{ width: `${(s.value / 5) * 100}%` }} /></span>
              <span className="text-[11px] font-semibold w-7 text-right">{s.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed mt-3">{data.signals.map((s) => `${s.label}: ${s.def}`).join(' ')}</p>
        {data.isFloat && <p className="text-[11px] text-gray-400 mt-2">Lesson plans aren’t part of a float’s score, so the other signals are reweighted.</p>}
        <div className="mt-3 text-[12px] text-gray-500">Lifetime <b className="text-gray-900">{data.lifetime.toFixed(1)}</b> across all centers — shown on your public profile if you choose.</div>
      </BottomSheet>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'green' | 'amber' }) {
  return (
    <div className="bg-white py-2.5 text-center">
      <div className={cn('text-lg font-semibold', tone === 'green' ? 'text-status-green' : tone === 'amber' ? 'text-status-amber' : 'text-gray-900')}>{value}</div>
      <div className="text-[9px] text-gray-400">{label}</div>
    </div>
  );
}
function Leave({ v, label }: { v: number; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-sm font-semibold text-gray-900">{v}h</div>
      <div className="text-[9px] text-gray-400">{label}</div>
    </div>
  );
}
function EmpRow({ href, onClick, icon, bg, title, sub }: { href?: string; onClick?: () => void; icon: React.ReactNode; bg: string; title: string; sub: string }) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>{icon}</span>
      <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{title}</p><p className="text-[11px] text-gray-500">{sub}</p></div>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <button onClick={onClick} className="w-full text-left">{inner}</button>;
}
