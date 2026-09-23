/**
 * Clock abstraction (docs/DECISIONS.md §4). All "what time is it" reads for
 * business logic go through a Clock so the engine is testable and the demo
 * sandbox can move time. This module is framework-agnostic; the cookie-reading
 * `getClock()` lives app-side (apps/web/lib/clock.ts) where next/headers exists.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A frozen clock at a fixed instant, for tests and the demo override. */
export function fixedClock(iso: string | Date): Clock {
  const at = typeof iso === 'string' ? new Date(iso) : new Date(iso.getTime());
  return { now: () => new Date(at.getTime()) };
}
