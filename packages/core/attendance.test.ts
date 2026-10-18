import { describe, it, expect } from 'vitest';
import { staffState, hoursWorked, breakHours, childState } from './attendance';

// Local-time Date literals (no trailing Z) so getHours()/getMinutes() are
// timezone-independent — the label times below are deterministic anywhere.
const d = (s: string) => new Date(s);
const NOW = d('2026-10-05T10:00:00');

describe('staffState', () => {
  it('1. no punch but scheduled + rostered → late, mismatch, labelled', () => {
    const r = staffState({ scheduledStart: d('2026-10-05T07:00:00'), rostered: true, now: NOW });
    expect(r.state).toBe('late');
    expect(r.rosterMismatch).toBe(true);
    expect(r.label).toBe('Scheduled 7:00 AM · no punch, but rostered');
  });

  it('1b. no punch, scheduled, NOT rostered → late, no mismatch', () => {
    const r = staffState({ scheduledStart: d('2026-10-05T07:00:00'), rostered: false, now: NOW });
    expect(r.state).toBe('late');
    expect(r.rosterMismatch).toBe(false);
    expect(r.label).toBe('Scheduled 7:00 AM · no punch');
  });

  it('2. no punch, nothing scheduled, not rostered → oncall', () => {
    const r = staffState({ rostered: false, now: NOW });
    expect(r.state).toBe('oncall');
    expect(r.rosterMismatch).toBe(false);
  });

  it('2b. rostered with no schedule and no punch still flags a mismatch', () => {
    const r = staffState({ rostered: true, now: NOW });
    expect(r.state).toBe('late');
    expect(r.rosterMismatch).toBe(true);
  });

  it('3. punched in, open break → break', () => {
    const r = staffState({ punchIn: d('2026-10-05T07:05:00'), breakStart: d('2026-10-05T09:45:00'), rostered: true, now: NOW });
    expect(r.state).toBe('break');
    expect(r.rosterMismatch).toBe(false);
  });

  it('3b. a closed break does not keep them on break', () => {
    const r = staffState({
      punchIn: d('2026-10-05T07:05:00'),
      breakStart: d('2026-10-05T09:00:00'),
      breakEnd: d('2026-10-05T09:15:00'),
      rostered: true,
      now: NOW,
    });
    expect(r.state).toBe('in');
  });

  it('4. punched out → out', () => {
    const r = staffState({ punchIn: d('2026-10-05T07:05:00'), punchOut: d('2026-10-05T15:30:00'), rostered: true, now: NOW });
    expect(r.state).toBe('out');
    expect(r.label).toBe('Clocked out 3:30 PM');
  });

  it('5. punched in, no break, no out → in', () => {
    const r = staffState({ punchIn: d('2026-10-05T07:05:00'), rostered: true, now: NOW });
    expect(r.state).toBe('in');
    expect(r.rosterMismatch).toBe(false);
  });
});

describe('hoursWorked', () => {
  it('clocked time minus a closed break', () => {
    // 7:00 → 15:00 = 8h, minus a 30m break = 7.5h
    const h = hoursWorked(d('2026-10-05T07:00:00'), d('2026-10-05T15:00:00'), [{ start: d('2026-10-05T12:00:00'), end: d('2026-10-05T12:30:00') }], NOW);
    expect(h).toBeCloseTo(7.5, 5);
  });

  it('open shift counts up to now', () => {
    // 7:00 → now(10:00) = 3h, no breaks
    expect(hoursWorked(d('2026-10-05T07:00:00'), null, [], NOW)).toBeCloseTo(3, 5);
  });

  it('open break counts up to now and is subtracted', () => {
    // 7:00 → now(10:00) = 3h gross; open break from 9:30 → now = 0.5h; worked = 2.5h
    const h = hoursWorked(d('2026-10-05T07:00:00'), null, [{ start: d('2026-10-05T09:30:00'), end: null }], NOW);
    expect(h).toBeCloseTo(2.5, 5);
  });

  it('breaks are clamped to the shift and never go negative', () => {
    // a break that runs past punch-out is clamped to the shift end
    const h = hoursWorked(d('2026-10-05T07:00:00'), d('2026-10-05T08:00:00'), [{ start: d('2026-10-05T07:30:00'), end: d('2026-10-05T09:00:00') }], NOW);
    expect(h).toBeCloseTo(0.5, 5); // 1h shift, 30m of the break falls inside it
  });

  it('returns 0 when out precedes in', () => {
    expect(hoursWorked(d('2026-10-05T10:00:00'), d('2026-10-05T09:00:00'), [], NOW)).toBe(0);
  });
});

describe('breakHours', () => {
  it('sums closed and open breaks', () => {
    const h = breakHours(
      [
        { start: d('2026-10-05T09:00:00'), end: d('2026-10-05T09:15:00') },
        { start: d('2026-10-05T09:45:00'), end: null },
      ],
      NOW,
    );
    expect(h).toBeCloseTo(0.25 + 0.25, 5); // 15m + 15m (9:45 → now 10:00)
  });
});

describe('childState', () => {
  it('here / gone / absent', () => {
    expect(childState({ signedIn: d('2026-10-05T08:00:00') })).toBe('here');
    expect(childState({ signedIn: d('2026-10-05T08:00:00'), signedOut: d('2026-10-05T12:00:00') })).toBe('gone');
    expect(childState({})).toBe('absent');
  });
});
