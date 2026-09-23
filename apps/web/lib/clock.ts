import { cookies } from 'next/headers';
import { type Clock, systemClock, fixedClock } from '@kinderbase/core';

export { type Clock, systemClock, fixedClock } from '@kinderbase/core';

/**
 * Server clock (docs/sessions/01-ENGINE.md §1). Returns the real clock unless
 * DEMO_MODE=true and a `kb_demo_now` cookie (ISO instant) is set — the /demo
 * sandbox and /dev/staffing use that to move time. Reading the cookie needs
 * next/headers, so this wrapper lives in the web app; packages/core stays pure.
 */
export function getClock(): Clock {
  if (process.env.DEMO_MODE === 'true') {
    try {
      const iso = cookies().get('kb_demo_now')?.value;
      if (iso) return fixedClock(iso);
    } catch {
      /* cookies() unavailable outside a request scope — fall through */
    }
  }
  return systemClock;
}
