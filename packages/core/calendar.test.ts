import { describe, it, expect } from 'vitest';
import { canSee, filterVisible, monthCells, BUILTIN_CAL_TYPES, type CalItem, type CalType, type Audience } from './calendar';

const byKey = Object.fromEntries(BUILTIN_CAL_TYPES.map((t) => [t.key, t])) as Record<string, CalType>;

describe('canSee', () => {
  it('follows the audience matrix for a normal type', () => {
    const trip = byKey.trip; // visible to everyone
    expect(canSee(trip, 'family')).toBe(true);
    expect(canSee(trip, 'staff')).toBe(true);
    expect(canSee(trip, 'admin')).toBe(true);
  });

  it('hides admin-only types from staff and families', () => {
    const timeoff = byKey.timeoff; // admin only
    expect(canSee(timeoff, 'admin')).toBe(true);
    expect(canSee(timeoff, 'staff')).toBe(false);
    expect(canSee(timeoff, 'family')).toBe(false);
  });

  it('hides staff-visible-but-not-family types from families', () => {
    const training = byKey.training;
    expect(canSee(training, 'staff')).toBe(true);
    expect(canSee(training, 'family')).toBe(false);
  });

  it('ALWAYS shows a person their own time-off, even as staff', () => {
    const item: CalItem = { date: '2026-10-08', typeKey: 'timeoff', title: 'Vacation', userId: 'me', derived: true };
    // staff normally cannot see timeoff…
    expect(canSee(byKey.timeoff, 'staff', { viewerId: 'someone-else', item })).toBe(false);
    // …but the owner always can.
    expect(canSee(byKey.timeoff, 'staff', { viewerId: 'me', item })).toBe(true);
  });
});

describe('filterVisible (derived-merge shape)', () => {
  const items: CalItem[] = [
    { id: '1', date: '2026-10-02', typeKey: 'trip', title: 'Firehouse' },
    { id: '2', date: '2026-10-08', typeKey: 'timeoff', title: 'Vacation', userId: 'kim', derived: true },
    { id: '3', date: '2026-10-09', typeKey: 'timeoff', title: 'Leave', userId: 'davis', derived: true },
    { id: '4', date: '2026-10-15', typeKey: 'licensing', title: 'CPR expires', derived: true },
    { id: '5', date: '2026-10-13', typeKey: 'unknown_type', title: 'Orphan' },
  ];

  it('a director sees every known-type item', () => {
    const out = filterVisible(items, byKey, 'admin', 'director');
    expect(out.map((i) => i.id)).toEqual(['1', '2', '3', '4']); // orphan type dropped
  });

  it('staff see only public types plus their own time off', () => {
    const kim = filterVisible(items, byKey, 'staff', 'kim');
    expect(kim.map((i) => i.id).sort()).toEqual(['1', '2']); // trip + own vacation, not davis' leave or licensing
  });

  it('drops items whose type is unknown', () => {
    expect(filterVisible(items, byKey, 'admin').some((i) => i.typeKey === 'unknown_type')).toBe(false);
  });
});

describe('monthCells', () => {
  it('always returns a 42-cell (6-week) Sunday-first grid', () => {
    const cells = monthCells(2026, 8); // September 2026
    expect(cells).toHaveLength(42);
  });

  it('marks spill days outside the target month', () => {
    // Oct 2026: Oct 1 is a Thursday, so the grid starts on Sun Sep 27.
    const cells = monthCells(2026, 9);
    expect(cells[0]).toEqual({ iso: '2026-09-27', outside: true });
    expect(cells.find((c) => c.iso === '2026-10-01')!.outside).toBe(false);
    expect(cells.find((c) => c.iso === '2026-10-31')!.outside).toBe(false);
  });

  it('includes every day of the month exactly once', () => {
    const cells = monthCells(2026, 1); // Feb 2026 (28 days)
    const inMonth = cells.filter((c) => !c.outside);
    expect(inMonth).toHaveLength(28);
    expect(new Set(inMonth.map((c) => c.iso)).size).toBe(28);
  });
});
