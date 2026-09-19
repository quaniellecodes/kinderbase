import { describe, it, expect } from 'vitest';
import {
  ageInMonths,
  formatAgeMonths,
  comarGroupForMonths,
  nextComarBoundary,
  daysUntil,
} from '@kinderbase/types';
import { computeRatio, getRatioCitation } from './staffing-engine';

describe('ageInMonths', () => {
  it('computes whole months, not-yet-reached day counts down', () => {
    // born 2025-01-15, as of 2025-11-19 → 10 months (day 19 >= 15)
    expect(ageInMonths('2025-01-15', new Date('2025-11-19T12:00:00'))).toBe(10);
    // as of 2025-11-10 → day 10 < 15 → 9 months
    expect(ageInMonths('2025-01-15', new Date('2025-11-10T12:00:00'))).toBe(9);
  });
});

describe('formatAgeMonths', () => {
  it('short and long forms', () => {
    expect(formatAgeMonths(10, 'short')).toBe('10 mo');
    expect(formatAgeMonths(10, 'long')).toBe('10 months');
    expect(formatAgeMonths(1, 'long')).toBe('1 month');
  });
});

describe('comarGroupForMonths', () => {
  it('maps months to age-group bands', () => {
    expect(comarGroupForMonths(0)).toBe('infant');
    expect(comarGroupForMonths(11)).toBe('infant');
    expect(comarGroupForMonths(12)).toBe('toddler');
    expect(comarGroupForMonths(23)).toBe('toddler');
    expect(comarGroupForMonths(24)).toBe('two_year');
    expect(comarGroupForMonths(36)).toBe('preschool');
    expect(comarGroupForMonths(60)).toBe('school_age');
  });
});

describe('nextComarBoundary', () => {
  it('finds the date a child turns into the next band', () => {
    // born 2024-11-27; as of 2025-11-19 age = 11 months → next boundary at 12 mo on 2024-11-27+12 = 2025-11-27
    const b = nextComarBoundary('2024-11-27', new Date('2025-11-19T12:00:00'));
    expect(b).not.toBeNull();
    expect(b!.date).toBe('2025-11-27');
    expect(b!.fromGroup).toBe('infant');
    expect(b!.toGroup).toBe('toddler');
    expect(daysUntil('2025-11-27', new Date('2025-11-19T12:00:00'))).toBe(8);
  });

  it('returns null once in the oldest band', () => {
    expect(nextComarBoundary('2018-01-01', new Date('2025-11-19T12:00:00'))).toBeNull();
  });
});

describe('computeRatio override', () => {
  it('Manual override supersedes the COMAR default', () => {
    // preschool default is 1:10 → 12 kids/1 staff = violation (needs 2)
    expect(computeRatio('preschool', 12, 1, 'MD').status).toBe('violation');
    // Manual override 1:12 → 12 kids/1 staff = warning (exactly at minimum)
    const r = computeRatio('preschool', 12, 1, 'MD', { childrenPerStaff: 12, maxGroupSize: 24 });
    expect(r.status).toBe('warning');
    expect(r.childrenPerStaff).toBe(12);
    expect(r.maxGroupSize).toBe(24);
  });
});

describe('getRatioCitation', () => {
  it('returns a COMAR citation per age group, falling back to MD', () => {
    expect(getRatioCitation('infant', 'MD')).toContain('COMAR');
    expect(getRatioCitation('preschool', 'XX')).toContain('COMAR'); // unknown state → MD
  });
});
