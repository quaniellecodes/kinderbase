'use client';

import { useState, useEffect, useTransition } from 'react';
import type { TimeEntryRow } from '@kinderbase/types';
import { clockIn, clockOut } from '@/app/(dashboard)/time/actions';
import { hapticSuccess } from '@/lib/mobile/capacitor';

type Props = {
  centerId: string;
  initialEntry: TimeEntryRow | null;
};

function formatElapsed(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ClockButton({ centerId, initialEntry }: Props) {
  const [entry, setEntry] = useState<TimeEntryRow | null>(initialEntry);
  const [elapsed, setElapsed] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!entry) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - new Date(entry.clocked_in_at).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entry]);

  async function handlePress() {
    startTransition(async () => {
      if (entry) {
        const result = await clockOut(entry.id);
        if (result.entry) {
          setEntry(null);
          await hapticSuccess();
        }
      } else {
        const result = await clockIn(centerId);
        if (result.entry) {
          setEntry(result.entry as TimeEntryRow);
          await hapticSuccess();
        }
      }
    });
  }

  const isClockedIn = !!entry;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handlePress}
        disabled={isPending}
        className={`w-40 h-40 rounded-full text-white font-medium text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60 ${
          isClockedIn
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isPending ? '...' : isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>

      {isClockedIn && (
        <div className="text-center">
          <p className="text-2xl font-mono font-medium text-gray-900">{formatElapsed(elapsed)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Since {new Date(entry.clocked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      )}

      {!isClockedIn && (
        <p className="text-sm text-gray-400">Tap to clock in</p>
      )}
    </div>
  );
}
