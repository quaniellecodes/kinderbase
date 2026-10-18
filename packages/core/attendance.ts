/**
 * Attendance state + hours, pure and testable (docs/sessions/09-TIME-LOG.md §4).
 *
 * The punch is authoritative, not the roster. Hours worked = clocked time minus
 * EVERY break, whatever its length — there is no short-break or meal exception.
 * Nothing here classifies a break for payroll; those rules are applied by the
 * accountant at ADP export time. The export carries raw punches, never a derived
 * payable figure, and no compensation-classification vocabulary appears anywhere
 * in this codebase by design (docs/sessions/09-TIME-LOG.md §2).
 */

export type StaffState = 'in' | 'break' | 'late' | 'out' | 'oncall';
export type ChildState = 'here' | 'gone' | 'absent';

export interface StaffStateInput {
  punchIn?: Date;
  punchOut?: Date;
  breakStart?: Date;
  breakEnd?: Date;
  /** The shift this person is scheduled to start today, if the roster has one. */
  scheduledStart?: Date;
  /** Whether they are counted on a room's roster (toward ratio) today. */
  rostered: boolean;
  now: Date;
}

export interface StaffStateResult {
  state: StaffState;
  label: string;
  /**
   * True when someone is counted on a roster but has no punch. The staffing
   * engine counts a scheduled person toward ratio while the kiosk says nobody
   * arrived — so a dashboard can read compliant while the room is actually
   * short. Surface this; do not hide it.
   */
  rosterMismatch: boolean;
}

/** "7:00 AM" from a Date's local time — deterministic given a local-time Date. */
function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Resolve a staff member's current state. Order (09 §4):
 *   1. No punch but scheduled / rostered → `late` (rosterMismatch = rostered).
 *   2. No punch and nothing scheduled     → `oncall`.
 *   3. Open break                          → `break`.
 *   4. Punched out                         → `out`.
 *   5. Otherwise                           → `in`.
 */
export function staffState(i: StaffStateInput): StaffStateResult {
  const hasPunch = !!i.punchIn;

  if (!hasPunch) {
    if (i.scheduledStart || i.rostered) {
      const sched = i.scheduledStart ? `Scheduled ${fmtTime(i.scheduledStart)} · no punch` : 'Rostered · no punch';
      return {
        state: 'late',
        label: i.rostered ? `${sched}, but rostered` : sched,
        rosterMismatch: i.rostered,
      };
    }
    return { state: 'oncall', label: 'On call · not scheduled', rosterMismatch: false };
  }

  if (i.breakStart && !i.breakEnd) {
    return { state: 'break', label: 'On break', rosterMismatch: false };
  }
  if (i.punchOut) {
    return { state: 'out', label: `Clocked out ${fmtTime(i.punchOut)}`, rosterMismatch: false };
  }
  return { state: 'in', label: 'On the floor', rosterMismatch: false };
}

/**
 * Hours worked = clocked time − every break. An open shift counts up to `now`;
 * an open break (no end) also counts up to `now`. Breaks are clamped to the
 * shift window so stray data can't push the result negative.
 */
export function hoursWorked(
  punchIn: Date,
  punchOut: Date | null,
  breaks: { start: Date; end: Date | null }[],
  now: Date,
): number {
  const start = punchIn.getTime();
  const end = (punchOut ?? now).getTime();
  if (end <= start) return 0;

  let breakMs = 0;
  for (const b of breaks) {
    const bs = Math.max(start, b.start.getTime());
    const be = Math.min(end, (b.end ?? now).getTime());
    if (be > bs) breakMs += be - bs;
  }
  return Math.max(0, end - start - breakMs) / 3_600_000;
}

/** Total break time in hours (open break counts up to `now`). */
export function breakHours(breaks: { start: Date; end: Date | null }[], now: Date): number {
  let ms = 0;
  for (const b of breaks) {
    const be = (b.end ?? now).getTime();
    if (be > b.start.getTime()) ms += be - b.start.getTime();
  }
  return ms / 3_600_000;
}

/** A child's attendance state from their row today (no row → absent). */
export function childState(i: { signedIn?: Date | null; signedOut?: Date | null }): ChildState {
  if (i.signedOut) return 'gone';
  if (i.signedIn) return 'here';
  return 'absent';
}
