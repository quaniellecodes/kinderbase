'use server';

import { revalidatePath } from 'next/cache';
import { ageInMonths } from '@kinderbase/types';
import type { Database } from '@kinderbase/types/database';
import { studentContext, isEditor, orNull } from '../access';
import type { ReferralStage } from './evaluation-constants';

export type ReferralInput = { id: string; body: string; author: string; observationCount: number; submittedAt: string };
export type PlanGoal = { id: string; goalText: string; strategy: string; progressNote: string; reviewedOn: string };
export type Referral = {
  id: string;
  stage: ReferralStage;
  concernSummary: string;
  agency: string;
  isPartC: boolean;
  raisedOn: string;
  parentConsentOn: string;
  referredOn: string;
  evaluationOn: string;
  planType: string;
  planStart: string;
  planReviewDue: string;
  closedOn: string;
  inputs: ReferralInput[];
  planGoals: PlanGoal[];
};

export type EvaluationData = {
  canEdit: boolean;
  ageMonths: number;
  partByAge: 'C' | 'B';
  suggestedAgency: string;
  turning3: { soon: boolean; date: string } | null;
  referrals: Referral[];
  observations: { id: string; title: string; observedOn: string }[];
};

function thirdBirthday(birthdate: string): string {
  const d = new Date(`${birthdate}T00:00:00`);
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().slice(0, 10);
}

export async function getEvaluation(childId: string): Promise<EvaluationData | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;

  const { data: child } = await service.from('children').select('birthdate').eq('id', childId).single();
  const ageMonths = child ? ageInMonths(child.birthdate) : 0;
  const partByAge: 'C' | 'B' = ageMonths < 36 ? 'C' : 'B';
  const suggestedAgency = partByAge === 'C' ? 'Maryland Infants & Toddlers Program (MITP)' : 'Local school system Child Find';

  let turning3: EvaluationData['turning3'] = null;
  if (child && ageMonths < 36) {
    const date = thirdBirthday(child.birthdate);
    const days = Math.round((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    turning3 = { soon: days >= 0 && days <= 90, date };
  }

  const { data: referrals } = await service
    .from('referrals')
    .select('id, stage, concern_summary, agency, is_part_c, raised_on, parent_consent_on, referred_on, evaluation_on, plan_type, plan_start, plan_review_due, closed_on, referral_inputs(id, body, submitted_at, observation_ids, users(full_name)), plan_goals(id, goal_text, strategy, progress_note, reviewed_on)')
    .eq('child_id', childId)
    .order('raised_on', { ascending: false });

  const { data: obs } = await service
    .from('observations')
    .select('id, title, observed_on')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('observed_on', { ascending: false })
    .limit(50);

  const mapped: Referral[] = (referrals ?? []).map((r) => ({
    id: r.id,
    stage: r.stage as ReferralStage,
    concernSummary: r.concern_summary,
    agency: r.agency ?? '',
    isPartC: r.is_part_c,
    raisedOn: r.raised_on ?? '',
    parentConsentOn: r.parent_consent_on ?? '',
    referredOn: r.referred_on ?? '',
    evaluationOn: r.evaluation_on ?? '',
    planType: r.plan_type ?? '',
    planStart: r.plan_start ?? '',
    planReviewDue: r.plan_review_due ?? '',
    closedOn: r.closed_on ?? '',
    inputs: ((r.referral_inputs ?? []) as { id: string; body: string; submitted_at: string; observation_ids: string[] | null; users: { full_name: string } | { full_name: string }[] | null }[]).map((i) => {
      const u = Array.isArray(i.users) ? i.users[0] : i.users;
      return { id: i.id, body: i.body, author: u?.full_name ?? 'Staff', observationCount: (i.observation_ids ?? []).length, submittedAt: i.submitted_at };
    }),
    planGoals: ((r.plan_goals ?? []) as { id: string; goal_text: string; strategy: string | null; progress_note: string | null; reviewed_on: string | null }[]).map((p) => ({
      id: p.id,
      goalText: p.goal_text,
      strategy: p.strategy ?? '',
      progressNote: p.progress_note ?? '',
      reviewedOn: p.reviewed_on ?? '',
    })),
  }));

  return {
    canEdit: isEditor(role),
    ageMonths,
    partByAge,
    suggestedAgency,
    turning3,
    referrals: mapped,
    observations: (obs ?? []).map((o) => ({ id: o.id, title: o.title, observedOn: o.observed_on })),
  };
}

export async function createReferral(childId: string, input: { concernSummary: string; isPartC: boolean; agency: string }): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, centerId, userId } = ctx;
  const { error } = await service.from('referrals').insert({
    child_id: childId,
    center_id: centerId,
    stage: 'concern_raised',
    concern_summary: input.concernSummary.trim() || 'Concern raised',
    raised_by: userId,
    raised_on: new Date().toISOString().slice(0, 10),
    agency: orNull(input.agency),
    is_part_c: input.isPartC,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function setReferralStage(childId: string, referralId: string, stage: ReferralStage): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { stage };
  if (stage === 'parent_consent_pending') patch.parent_consent_on = null;
  if (stage === 'referred') patch.referred_on = today;
  if (stage === 'evaluation_scheduled') patch.evaluation_on = today;
  if (stage === 'services_active') patch.plan_start = today;
  if (stage === 'closed') patch.closed_on = today;
  const { error } = await service
    .from('referrals')
    .update(patch as unknown as Database['public']['Tables']['referrals']['Update'])
    .eq('id', referralId)
    .eq('child_id', childId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function addReferralInput(childId: string, referralId: string, input: { body: string; observationIds: string[] }): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx) throw new Error('Forbidden');
  const { service, userId } = ctx;
  if (!input.body.trim()) throw new Error('Input text required');
  const { error } = await service.from('referral_inputs').insert({
    referral_id: referralId,
    submitted_by: userId,
    body: input.body.trim(),
    observation_ids: input.observationIds.length ? input.observationIds : null,
  });
  if (error) throw new Error(error.message);
  // Advance the stage to reflect that input has been contributed.
  await service.from('referrals').update({ stage: 'input_submitted' }).eq('id', referralId).eq('child_id', childId).eq('stage', 'referred');
  revalidatePath(`/students/${childId}`);
}

export async function addPlanGoal(childId: string, referralId: string, input: { goalText: string; strategy: string }): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service } = ctx;
  if (!input.goalText.trim()) throw new Error('Goal text required');
  const { error } = await service.from('plan_goals').insert({
    referral_id: referralId,
    goal_text: input.goalText.trim(),
    strategy: orNull(input.strategy),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}
