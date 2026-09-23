'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { DemoPersona } from '@/lib/demo';

const DEVICES = {
  phone: { label: 'Phone', w: 390, h: 844, radius: 44, bezel: 12 },
  tablet: { label: 'Tablet', w: 800, h: 1040, radius: 26, bezel: 14 },
};
type Device = keyof typeof DEVICES;

const CLOCKS = [
  { hhmm: '09:12', label: '9:12 AM' },
  { hhmm: '12:05', label: '12:05 · nap' },
  { hhmm: '15:10', label: '3:10 PM' },
];

type ScenarioRole = 'director' | 'lead_teacher' | 'assistant_teacher' | 'substitute';
const SCENARIOS: { key: string; label: string; clock: string; role: ScenarioRole; blurb: string }[] = [
  { key: 'ratio', label: 'Room out of ratio', clock: '09:12', role: 'director', blurb: 'The engine flags a room below COMAR and suggests a fix.' },
  { key: 'float', label: 'Float reassignment', clock: '09:12', role: 'substitute', blurb: 'See the day from the floating teacher’s phone.' },
  { key: 'nap', label: 'Nap-time breaks', clock: '12:05', role: 'director', blurb: 'Who can step out while children rest.' },
  { key: 'plan', label: 'Lesson-plan review', clock: '09:12', role: 'director', blurb: 'A submitted plan waiting in the Inbox.' },
  { key: 'families', label: 'Families & translation', clock: '09:12', role: 'lead_teacher', blurb: 'An unanswered thread and a Spanish family.' },
];

const STORIES: { n: number; title: string; body: string }[] = [
  { n: 1, title: 'Morning check-in', body: 'Open as the Director at 9:12. The Home screen runs every room through the staffing engine and flags the one that’s out of ratio.' },
  { n: 2, title: 'Fix the room', body: 'Tap the alert to assign a float or move a child — each option is simulated against COMAR before you commit.' },
  { n: 3, title: 'The teacher’s phone', body: 'Switch to the Lead. Log a care update, post an observation, and see the day’s priorities and lesson plan.' },
  { n: 4, title: 'Nap-time breaks', body: 'Jump the clock to 12:05. The app shows who can step out for a break while children are resting.' },
  { n: 5, title: 'Families', body: 'Open Messages. A family message has gone unanswered for a day (it’s flagged red), and a Spanish thread translates both ways.' },
];

export function DemoStage({
  personas,
  currentUserId,
  centerId,
  nowHHmm,
  overrideActive,
}: {
  personas: DemoPersona[];
  currentUserId: string;
  centerId: string;
  nowHHmm: string;
  overrideActive: boolean;
}) {
  const [device, setDevice] = useState<Device>('phone');
  const [busy, setBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('kb_demo_device') as Device | null;
    if (saved && DEVICES[saved]) setDevice(saved);
  }, []);
  function pickDevice(d: Device) {
    setDevice(d);
    localStorage.setItem('kb_demo_device', d);
  }

  async function loginAs(userId: string) {
    if (userId === currentUserId || busy) return;
    setBusy(true);
    await fetch('/api/demo/login/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, centerId }) });
    location.reload();
  }
  function writeClockCookie(hhmm: string) {
    const d = new Date();
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h!, m!, 0, 0);
    document.cookie = `kb_demo_now=${encodeURIComponent(d.toISOString())}; path=/; max-age=86400`;
  }
  function setClock(hhmm: string) {
    writeClockCookie(hhmm);
    location.reload();
  }
  function realTime() {
    document.cookie = 'kb_demo_now=; path=/; max-age=0';
    location.reload();
  }

  async function resetDemo() {
    if (busy || !confirm('Reset the demo to the Director at 9:12?')) return;
    setBusy(true);
    await fetch('/api/demo/reset/', { method: 'POST' });
    location.reload();
  }

  // A scenario is a one-tap (clock + persona) preset over the seeded baseline.
  async function runScenario(clock: string, role: ScenarioRole) {
    if (busy) return;
    setBusy(true);
    writeClockCookie(clock);
    const persona = personas.find((p) => p.role === role);
    if (persona && persona.userId !== currentUserId) {
      await fetch('/api/demo/login/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: persona.userId, centerId }) });
    }
    location.reload();
  }

  const dev = DEVICES[device];
  const chip = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors text-left';

  return (
    <div className="min-h-screen bg-[#eceae4] flex flex-col lg:flex-row items-start justify-center gap-6 p-4 lg:p-8">
      {/* Device frame */}
      <div className="flex-shrink-0 mx-auto">
        <div className="bg-[#1a1a18] shadow-2xl" style={{ borderRadius: dev.radius, padding: dev.bezel, width: 'min(100%, ' + (dev.w + dev.bezel * 2) + 'px)' }}>
          <div className="bg-white overflow-hidden relative" style={{ borderRadius: dev.radius - dev.bezel, height: `min(${dev.h}px, 84vh)` }}>
            <iframe ref={iframeRef} src="/m" title="KinderBase mobile" className="w-full h-full border-0" />
          </div>
        </div>
      </div>

      {/* Control panel */}
      <div className="w-full lg:w-[300px] flex-shrink-0 space-y-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">KinderBase — mobile</h1>
          <p className="text-xs text-gray-500">Live app in a phone. Switch persona, time, and device.</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Who's holding the phone</p>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((p) => (
              <button
                key={p.userId}
                onClick={() => loginAs(p.userId)}
                className={cn('rounded-xl border p-2.5 text-left', p.userId === currentUserId ? 'border-brand bg-[#FFF8F2]' : 'border-gray-200 bg-white')}
              >
                <div className="text-[13px] font-semibold text-gray-900">{p.roleLabel === 'Director' ? 'Director' : p.label}</div>
                <div className="text-[10px] text-gray-500">{p.roleLabel}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Time of day</p>
          <div className="flex flex-col gap-1.5">
            {CLOCKS.map((c) => {
              const active = overrideActive && nowHHmm === c.hhmm;
              return (
                <button key={c.hhmm} onClick={() => setClock(c.hhmm)} className={cn(chip, 'border', active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200')}>
                  {c.label}
                </button>
              );
            })}
            {overrideActive && <button onClick={realTime} className={cn(chip, 'border bg-white text-gray-500 border-gray-200')}>Real time</button>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Device</p>
          <div className="flex bg-white border border-gray-200 rounded-lg p-1">
            {(Object.keys(DEVICES) as Device[]).map((d) => (
              <button key={d} onClick={() => pickDevice(d)} className={cn('flex-1 text-xs font-semibold py-1.5 rounded-md', device === d ? 'bg-brand text-white' : 'text-gray-500')}>
                {DEVICES[d].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Scenarios</p>
          <div className="flex flex-col gap-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                onClick={() => runScenario(s.clock, s.role)}
                disabled={busy}
                className="rounded-xl border border-gray-200 bg-white p-2.5 text-left disabled:opacity-50"
              >
                <div className="text-[12px] font-semibold text-gray-900">{s.label}</div>
                <div className="text-[10px] text-gray-500 leading-snug">{s.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Stories to walk through</p>
          <ol className="space-y-2">
            {STORIES.map((s) => (
              <li key={s.n} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[11px] font-bold flex items-center justify-center">{s.n}</span>
                <div>
                  <div className="text-[12px] font-semibold text-gray-900">{s.title}</div>
                  <div className="text-[10px] text-gray-500 leading-snug">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Link href="/dashboard" className="text-xs font-semibold text-brand">← Back to desktop</Link>
          <button onClick={resetDemo} disabled={busy} className="text-xs font-semibold text-gray-500 disabled:opacity-50">Reset demo</button>
        </div>
      </div>
    </div>
  );
}
