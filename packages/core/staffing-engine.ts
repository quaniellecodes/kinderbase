import type { AgeGroup } from '@kinderbase/types';

type RatioRule = {
  childrenPerStaff: number;
  maxGroupSize: number;
};

// Maryland COMAR 13A.16 ratios — extend as new states are added
const RATIO_RULES: Record<string, Record<AgeGroup, RatioRule>> = {
  MD: {
    infant:     { childrenPerStaff: 3,  maxGroupSize: 6  },
    toddler:    { childrenPerStaff: 3,  maxGroupSize: 6  },
    two_year:   { childrenPerStaff: 6,  maxGroupSize: 12 },
    preschool:  { childrenPerStaff: 10, maxGroupSize: 20 },
    school_age: { childrenPerStaff: 15, maxGroupSize: 30 },
  },
};

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
 */
export function computeRatio(
  ageGroup: AgeGroup,
  enrolledCount: number,
  staffCount: number,
  state: string
): RatioResult {
  const stateRules = RATIO_RULES[state] ?? RATIO_RULES['MD'];
  const rule = stateRules[ageGroup];
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
