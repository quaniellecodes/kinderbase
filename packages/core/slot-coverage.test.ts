import { describe, it, expect } from 'vitest';
import { collapseRuns, deriveOccPosition, slotToLabel, type ClassroomStaffingView } from '@kinderbase/types';
import { computeSlotCoverage } from './slot-coverage';

describe('collapseRuns', () => {
  it('empty → no runs', () => {
    expect(collapseRuns([])).toEqual([]);
  });

  it('single slot → one half-open run', () => {
    expect(collapseRuns([11])).toEqual([{ start: 11, end: 12 }]);
  });

  it('contiguous slots → one bar', () => {
    expect(collapseRuns([11, 12, 13, 14])).toEqual([{ start: 11, end: 15 }]);
  });

  it('gap (break) → two bars', () => {
    expect(collapseRuns([11, 12, 20, 21])).toEqual([
      { start: 11, end: 13 },
      { start: 20, end: 22 },
    ]);
  });

  it('unsorted with duplicates → normalized runs', () => {
    expect(collapseRuns([13, 11, 12, 11, 20])).toEqual([
      { start: 11, end: 14 },
      { start: 20, end: 21 },
    ]);
  });
});

describe('deriveOccPosition', () => {
  it('director/admin → D', () => {
    expect(deriveOccPosition('director', 'infant')).toBe('D');
    expect(deriveOccPosition('admin', 'preschool')).toBe('D');
  });

  it('lead_teacher maps by age group', () => {
    expect(deriveOccPosition('lead_teacher', 'infant')).toBe('TI');
    expect(deriveOccPosition('lead_teacher', 'toddler')).toBe('TI');
    expect(deriveOccPosition('lead_teacher', 'two_year')).toBe('TP');
    expect(deriveOccPosition('lead_teacher', 'preschool')).toBe('TP');
    expect(deriveOccPosition('lead_teacher', 'school_age')).toBe('TS');
  });

  it('assistant_teacher → ATS only for school age, else A', () => {
    expect(deriveOccPosition('assistant_teacher', 'school_age')).toBe('ATS');
    expect(deriveOccPosition('assistant_teacher', 'infant')).toBe('A');
  });

  it('aide/substitute → A', () => {
    expect(deriveOccPosition('aide', 'preschool')).toBe('A');
    expect(deriveOccPosition('substitute', 'preschool')).toBe('A');
  });
});

describe('slotToLabel', () => {
  it('formats half-hour slots on a 12-hour clock', () => {
    expect(slotToLabel(0)).toBe('12:00 AM');
    expect(slotToLabel(11)).toBe('5:30 AM');
    expect(slotToLabel(24)).toBe('12:00 PM');
    expect(slotToLabel(38)).toBe('7:00 PM');
    expect(slotToLabel(48)).toBe('12:00 AM'); // midnight (close boundary)
  });
});

describe('computeSlotCoverage', () => {
  const baseView: ClassroomStaffingView = {
    classroomId: 'c1',
    name: 'Underwater',
    ageGroup: 'infant',
    licensedCapacity: 9,
    typicalEnrollment: 6,
    patternEffectiveDate: null,
    state: 'MD',
    openSlot: 12, // 06:00
    closeSlot: 14, // 07:00 → slots 12, 13
    operatingDays: [1],
    roster: [
      { id: 's1', userId: 'u1', displayName: 'A', positionCode: 'TI', positionOverride: null, sortOrder: 0, slotsByDay: { 1: [12, 13] } },
      { id: 's2', userId: 'u2', displayName: 'B', positionCode: 'TI', positionOverride: null, sortOrder: 1, slotsByDay: { 1: [12] } },
    ],
    childCountsByDay: { 1: { 12: 6, 13: 3 } },
  };

  it('counts staff present per slot and applies the ratio', () => {
    const cov = computeSlotCoverage(baseView, 'MD');
    expect(cov).toHaveLength(2); // 2 slots, 1 day

    const slot12 = cov.find((c) => c.slot === 12)!;
    expect(slot12.actualStaff).toBe(2); // both present
    expect(slot12.totalChildren).toBe(6);
    expect(slot12.ratio.requiredStaff).toBe(2); // 6 infants at 1:3
    expect(slot12.ratio.status).toBe('warning'); // exactly at minimum (2 staff = 2 required)

    const slot13 = cov.find((c) => c.slot === 13)!;
    expect(slot13.actualStaff).toBe(1); // only A present
    expect(slot13.totalChildren).toBe(3);
  });

  it('only returns slots within operating hours', () => {
    const cov = computeSlotCoverage(baseView, 'MD');
    expect(cov.every((c) => c.slot >= 12 && c.slot < 14)).toBe(true);
  });

  it('missing child count defaults to 0', () => {
    const view = { ...baseView, childCountsByDay: {} };
    const cov = computeSlotCoverage(view, 'MD');
    expect(cov.every((c) => c.totalChildren === 0)).toBe(true);
  });
});
