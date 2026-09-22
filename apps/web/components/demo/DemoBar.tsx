'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { DemoPersona } from '@/lib/demo';

const CLOCKS: { hhmm: string; label: string }[] = [
  { hhmm: '09:12', label: '9:12' },
  { hhmm: '12:05', label: '12:05 · nap' },
  { hhmm: '15:10', label: '3:10' },
];

/**
 * DEMO_MODE-only floating dev bar (bottom-right): one-tap persona switch + demo
 * clock + desktop⇄mobile toggle. Manual-testing companion to the Phase-6 /demo
 * phone simulator. Never rendered outside DEMO_MODE.
 */
export function DemoBar({
  personas,
  currentUserId,
  centerId,
  nowHHmm,
  overrideActive,
  surface,
}: {
  personas: DemoPersona[];
  currentUserId: string;
  centerId: string;
  nowHHmm: string;
  overrideActive: boolean;
  surface: 'desktop' | 'mobile';
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function loginAs(userId: string) {
    if (userId === currentUserId || busy) return;
    setBusy(true);
    await fetch('/api/demo/login/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, centerId }) });
    location.reload();
  }
  function setClock(hhmm: string) {
    const d = new Date();
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h!, m!, 0, 0);
    document.cookie = `kb_demo_now=${encodeURIComponent(d.toISOString())}; path=/; max-age=86400`;
    location.reload();
  }
  function realTime() {
    document.cookie = 'kb_demo_now=; path=/; max-age=0';
    location.reload();
  }

  const chip = 'text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[60] bg-neutral-900 text-white text-[11px] font-semibold px-3 py-2 rounded-full shadow-lg">
        Demo
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 bg-neutral-900 text-white rounded-full pl-3 pr-2 py-1.5 shadow-xl max-w-[calc(100vw-2rem)] overflow-x-auto">
      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide flex-shrink-0">Viewing as</span>
      {personas.map((p) => (
        <button
          key={p.userId}
          onClick={() => loginAs(p.userId)}
          title={`${p.label} · ${p.roleLabel}`}
          className={cn(chip, p.userId === currentUserId ? 'bg-brand text-white' : 'bg-white/10 text-white/80 hover:bg-white/20')}
        >
          {p.roleLabel === 'Director' ? 'Director' : p.label}
        </button>
      ))}

      <span className="w-px h-4 bg-white/15 flex-shrink-0" />
      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide flex-shrink-0">Clock</span>
      {CLOCKS.map((c) => {
        const active = overrideActive && nowHHmm === c.hhmm;
        return (
          <button key={c.hhmm} onClick={() => setClock(c.hhmm)} className={cn(chip, active ? 'bg-brand text-white' : 'bg-white/10 text-white/80 hover:bg-white/20')}>
            {c.label}
          </button>
        );
      })}
      {overrideActive && (
        <button onClick={realTime} className={cn(chip, 'bg-white/10 text-white/60 hover:bg-white/20')}>Real</button>
      )}

      <span className="w-px h-4 bg-white/15 flex-shrink-0" />
      <Link href={surface === 'desktop' ? '/m' : '/dashboard'} className={cn(chip, 'bg-white/10 text-white/80 hover:bg-white/20')}>
        {surface === 'desktop' ? 'Mobile ↗' : 'Desktop ↗'}
      </Link>
      <button onClick={() => setOpen(false)} aria-label="Hide demo bar" className="text-white/40 hover:text-white/70 text-sm px-1 flex-shrink-0">×</button>
    </div>
  );
}
