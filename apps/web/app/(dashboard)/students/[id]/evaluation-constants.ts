// Plain (non-"use server") module so these runtime values can be exported and
// shared by both the server actions and the client UI. A "use server" file may
// only export async functions.

export type ReferralStage =
  | 'concern_raised'
  | 'parent_consent_pending'
  | 'referred'
  | 'input_submitted'
  | 'evaluation_scheduled'
  | 'eligible'
  | 'not_eligible'
  | 'services_active'
  | 'closed';

export const STAGE_FLOW: ReferralStage[] = [
  'concern_raised',
  'parent_consent_pending',
  'referred',
  'input_submitted',
  'evaluation_scheduled',
  'eligible',
  'services_active',
  'closed',
];

export const STAGE_LABELS: Record<ReferralStage, string> = {
  concern_raised: 'Concern raised',
  parent_consent_pending: 'Consent pending',
  referred: 'Referred',
  input_submitted: 'Input submitted',
  evaluation_scheduled: 'Evaluation scheduled',
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  services_active: 'Services active',
  closed: 'Closed',
};
