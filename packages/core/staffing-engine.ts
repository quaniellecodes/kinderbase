import type { AgeGroup } from '@kinderbase/types';

export type RatioRule = {
  childrenPerStaff: number;
  maxGroupSize: number;
};

// Maryland COMAR 13A.16 ratios — extend as new states are added
const RATIO_RULES: Record<string, Record<AgeGroup, RatioRule>> = {
  MD: {
    infant:     { childrenPerStaff: 3,  maxGroupSize: 6  },
    toddler:    { childrenPerStaff: 3,  maxGroupSize: 9  }, // §C toddlers: max group 9
    two_year:   { childrenPerStaff: 6,  maxGroupSize: 12 },
    preschool:  { childrenPerStaff: 10, maxGroupSize: 20 },
    school_age: { childrenPerStaff: 15, maxGroupSize: 30 },
  },
};

// COMAR regulation citations per age group (shown on the staffing-pattern badge).
// NOTE: best-effort section references — confirm exact §-letters against current
// COMAR 13A.16.03 before relying on these for filings.
const RATIO_CITATIONS: Record<string, Record<AgeGroup, string>> = {
  MD: {
    infant:     'COMAR 13A.16.03 §C(1)',
    toddler:    'COMAR 13A.16.03 §C(2)',
    two_year:   'COMAR 13A.16.03 §C(3)',
    preschool:  'COMAR 13A.16.03 §C(4)',
    school_age: 'COMAR 13A.16.03 §C(5)',
  },
};

/** Returns the COMAR (or state) citation string for an age group's ratio rule. */
export function getRatioCitation(ageGroup: AgeGroup, state: string): string {
  const stateCitations = RATIO_CITATIONS[state] ?? RATIO_CITATIONS['MD']!;
  return stateCitations[ageGroup];
}

export type RatioStatus = 'ok' | 'warning' | 'violation';

export type RatioResult = {
  status: RatioStatus;
  requiredStaff: number;
  actualStaff: number;
  childrenPerStaff: number;
  maxGroupSize: number;
  overCapacity: boolean;
};

/**
 * Computes ratio compliance for a classroom slot.
 * - violation: understaffed or over max group size
 * - warning: exactly at minimum (no buffer — one absence causes violation)
 * - ok: staffed above minimum
 *
 * `override` supplies a per-room Manual ratio (Auto/COMAR default when omitted).
 */
export function computeRatio(
  ageGroup: AgeGroup,
  enrolledCount: number,
  staffCount: number,
  state: string,
  override?: RatioRule
): RatioResult {
  const stateRules = RATIO_RULES[state] ?? RATIO_RULES['MD'];
  const rule = override ?? stateRules[ageGroup];
  const requiredStaff = Math.ceil(enrolledCount / rule.childrenPerStaff);
  const overCapacity = enrolledCount > rule.maxGroupSize;

  let status: RatioStatus;
  if (overCapacity || staffCount < requiredStaff) {
    status = 'violation';
  } else if (enrolledCount === 0 || staffCount > requiredStaff) {
    status = 'ok';
  } else {
    status = 'warning';
  }

  return {
    status,
    requiredStaff,
    actualStaff: staffCount,
    childrenPerStaff: rule.childrenPerStaff,
    maxGroupSize: rule.maxGroupSize,
    overCapacity,
  };
}

export function getRatioRule(ageGroup: AgeGroup, state: string): RatioRule {
  const stateRules = RATIO_RULES[state] ?? RATIO_RULES['MD'];
  return stateRules[ageGroup];
}
