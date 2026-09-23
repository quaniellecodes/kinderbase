'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ageInMonths, childDisplayName, type CenterRole } from '@kinderbase/types';
import type { Database } from '@kinderbase/types/database';

type Service = ReturnType<typeof createServiceClient>;

async function checkpointContext(
  cpId: string,
): Promise<{ service: Service; childId: string; centerId: string; role: CenterRole } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: cp } = await service.from('checkpoints').select('child_id, center_id').eq('id', cpId).maybeSingle();
  if (!cp) return null;
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', cp.center_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null;
  return { service, childId: cp.child_id, centerId: cp.center_id, role: m.role as CenterRole };
}

function isEditor(role: CenterRole): boolean {
  return role === 'director' || role === 'admin';
}

export type RatingLevel = { id: string; level: number; label: string; color: string };
export type CheckpointGoal = {
  id: string;
  code: string;
  text: string | null;
  progression: { band: string; descriptor: string | null } | null;
  ratingLevelId: string | null;
  note: string;
  evidence: { id: string; title: string; observedOn: string }[];
};
export type CheckpointDomain = { code: string; name: string; subdomains: { name: string; goals: CheckpointGoal[] }[] };
export type CheckpointDetail = {
  id: string;
  childId: string;
  childName: string;
  periodLabel: string;
  status: 'draft' | 'submitted' | 'locked';
  view: 'infant_toddler' | 'preschool';
  ageMonths: number;
  canEdit: boolean;
  ratingLevels: RatingLevel[];
  domains: CheckpointDomain[];
  ratedCount: number;
  totalGoals: number;
};

function bandLabel(min: number, max: number): string {
  const lo = min === 0 ? 'Birth' : `${min} mo`;
  return `${lo}–${max} mo`;
}

export async function getCheckpointDetail(cpId: string): Promise<CheckpointDetail | null> {
  const ctx = await checkpointContext(cpId);
  if (!ctx) return null;
  const { service, childId, role } = ctx;

  const { data: cp } = await service
    .from('checkpoints')
    .select('id, period_label, status, view, framework_id')
    .eq('id', cpId)
    .single();
  if (!cp) return null;

  const { data: child } = await service.from('children').select('first_name, last_name, birthdate').eq('id', childId).single();
  const ageMonths = child ? ageInMonths(child.birthdate) : 0;

  const { data: levels } = await service
    .from('rating_levels')
    .select('id, level_number, label, color')
    .is('center_id', null)
    .order('sort_order');

  const { data: domains } = await service
    .from('framework_domains')
    .select('id, code, name, sort_order, framework_subdomains(id, name, sort_order, framework_goals(id, code, goal_text, sort_order, goal_progressions(age_band_min_months, age_band_max_months, descriptor, sort_order)))')
    .eq('framework_id', cp.framework_id)
    .eq('view', cp.view)
    .order('sort_order');

  const { data: ratings } = await service
    .from('checkpoint_ratings')
    .select('goal_id, rating_level_id, note')
    .eq('checkpoint_id', cpId);
  const ratingByGoal = new Map((ratings ?? []).map((r) => [r.goal_id, r]));

  const { data: obsLinks } = await service
    .from('observation_goals')
    .select('goal_id, observations!inner(id, title, observed_on, child_id, deleted_at)')
    .eq('observations.child_id', childId);
  const evidenceByGoal = new Map<string, { id: string; title: string; observedOn: string }[]>();
  for (const link of obsLinks ?? []) {
    const o = Array.isArray(link.observations) ? link.observations[0] : link.observations;
    if (!o || o.deleted_at) continue;
    const arr = evidenceByGoal.get(link.goal_id) ?? [];
    arr.push({ id: o.id, title: o.title, observedOn: o.observed_on });
    evidenceByGoal.set(link.goal_id, arr);
  }

  let totalGoals = 0;
  let ratedCount = 0;
  const outDomains: CheckpointDomain[] = (domains ?? []).map((d) => {
    const subs = ((d.framework_subdomains ?? []) as {
      name: string;
      sort_order: number;
      framework_goals?: { id: string; code: string; goal_text: string | null; sort_order: number; goal_progressions?: { age_band_min_months: number; age_band_max_months: number; descriptor: string | null; sort_order: number }[] }[];
    }[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      code: d.code,
      name: d.name,
      subdomains: subs.map((s) => ({
        name: s.name,
        goals: (s.framework_goals ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((g) => {
            totalGoals++;
            const rating = ratingByGoal.get(g.id);
            if (rating?.rating_level_id) ratedCount++;
            const progs = (g.goal_progressions ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
            // current age band = last progression whose min <= ageMonths
            let current = progs.length ? progs[0] : null;
            for (const p of progs) if (p.age_band_min_months <= ageMonths) current = p;
            return {
              id: g.id,
              code: g.code,
              text: g.goal_text,
              progression: current ? { band: bandLabel(current.age_band_min_months, current.age_band_max_months), descriptor: current.descriptor } : null,
              ratingLevelId: rating?.rating_level_id ?? null,
              note: rating?.note ?? '',
              evidence: evidenceByGoal.get(g.id) ?? [],
            };
          }),
      })),
    };
  });

  return {
    id: cp.id,
    childId,
    childName: child ? childDisplayName(child) : 'Student',
    periodLabel: cp.period_label,
    status: cp.status as CheckpointDetail['status'],
    view: cp.view as CheckpointDetail['view'],
    ageMonths,
    canEdit: isEditor(role),
    ratingLevels: (levels ?? []).map((l) => ({ id: l.id, level: l.level_number, label: l.label, color: l.color })),
    domains: outDomains,
    ratedCount,
    totalGoals,
  };
}

export async function rateGoal(cpId: string, goalId: string, ratingLevelId: string | null, note: string): Promise<void> {
  const ctx = await checkpointContext(cpId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, childId } = ctx;
  const { data: cp } = await service.from('checkpoints').select('status').eq('id', cpId).single();
  if (cp?.status !== 'draft') throw new Error('Checkpoint is locked');

  const { error } = await service
    .from('checkpoint_ratings')
    .upsert(
      { checkpoint_id: cpId, goal_id: goalId, rating_level_id: ratingLevelId, note: note.trim() || null, rated_at: new Date().toISOString() },
      { onConflict: 'checkpoint_id,goal_id' },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}/checkpoint/${cpId}`);
}

export async function setCheckpointStatus(cpId: string, status: 'draft' | 'submitted'): Promise<void> {
  const ctx = await checkpointContext(cpId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, childId, role } = ctx;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const patch: Record<string, unknown> =
    status === 'submitted'
      ? { status: 'submitted', submitted_at: new Date().toISOString(), rated_by: user?.id ?? null }
      : { status: 'draft', submitted_at: null };
  // Reopening a submitted checkpoint is director/admin only (already gated by isEditor).
  void role;
  const { error } = await service
    .from('checkpoints')
    .update(patch as unknown as Database['public']['Tables']['checkpoints']['Update'])
    .eq('id', cpId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}/checkpoint/${cpId}`);
  revalidatePath(`/students/${childId}`);
}
