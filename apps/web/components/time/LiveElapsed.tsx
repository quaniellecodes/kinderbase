'use client';

import { useEffect, useState } from 'react';

/**
 * A live "counting up" elapsed timer. The baseline (serverNow − from) is computed
 * from the server clock so it is correct under the demo clock; it then ticks up in
 * real seconds from mount, so a frozen demo still feels alive without drifting the
 * starting value. Renders "2:38:14" (or "38:14" under an hour).
 */
export function LiveElapsed({ fromISO, serverNowISO, className }: { fromISO: string; serverNowISO: string; className?: string }) {
  const baseSeconds = Math.max(0, (new Date(serverNowISO).getTime() - new Date(fromISO).getTime()) / 1000);
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const mount = Date.now();
    const id = setInterval(() => setExtra((Date.now() - mount) / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.floor(baseSeconds + extra);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const text = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;

  return <span className={className} suppressHydrationWarning>{text}</span>;
}
