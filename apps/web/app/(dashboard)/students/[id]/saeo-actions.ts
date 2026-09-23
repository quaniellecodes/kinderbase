'use server';

import { revalidatePath } from 'next/cache';
import { ageInMonths } from '@kinderbase/types';
import { studentContext, isEditor } from '../access';
import { uploadStudentDocFile, getStudentDocSignedUrl } from '@/lib/storage/student-documents';

export type ElofView = 'infant_toddler' | 'preschool';

// ── framework/context ────────────────────────────────────────────────────────
export type SaeoContext = {
  canEdit: boolean;
  view: ElofView;
  ageMonths: number;
  hasFramework: boolean; // framework content seeded for this view
  frameworkId: string | null;
  photoConsent: boolean;
};

async function frameworkFor(service: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>) {
  const { data } = await service
    .from('frameworks')
    .select('id')
    .eq('name', 'Head Start Early Learning Outcomes Framework')
    .eq('is_system', true)
    .is('center_id', null)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getSaeoContext(childId: string): Promise<SaeoContext | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;
  const { data: child } = await service.from('children').select('birthdate, photo_consent').eq('id', childId).single();
  const ageMonths = child ? ageInMonths(child.birthdate) : 0;
  const view: ElofView = ageMonths < 36 ? 'infant_toddler' : 'preschool';
  const frameworkId = await frameworkFor(service);

  let hasFramework = false;
  if (frameworkId) {
    const { count } = await service
      .from('framework_domains')
      .select('id', { count: 'exact', head: true })
      .eq('framework_id', frameworkId)
      .eq('view', view);
    hasFramework = (count ?? 0) > 0;
  }
  return { canEdit: isEditor(role), view, ageMonths, hasFramework, frameworkId, photoConsent: !!child?.photo_consent };
}

export type GoalOption = { id: string; code: string; text: string | null; domain: string };

/** All goals for the child's ELOF view, flattened, for observation tagging. */
export async function getGoalOptions(childId: string): Promise<GoalOption[]> {
  const ctx = await studentContext(childId);
  if (!ctx) return [];
  const { service } = ctx;
  const sctx = await getSaeoContext(childId);
  if (!sctx?.frameworkId || !sctx.hasFramework) return [];

  const { data: domains } = await service
    .from('framework_domains')
    .select('id, code, framework_subdomains(id, framework_goals(id, code, goal_text, sort_order))')
    .eq('framework_id', sctx.frameworkId)
    .eq('view', sctx.view)
    .order('sort_order');

  const opts: GoalOption[] = [];
  for (const d of domains ?? []) {
    const subs = (d.framework_subdomains ?? []) as { framework_goals?: { id: string; code: string; goal_text: string | null; sort_order: number }[] }[];
    for (const s of subs) {
      for (const g of s.framework_goals ?? []) opts.push({ id: g.id, code: g.code, text: g.goal_text, domain: d.code });
    }
  }
  opts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return opts;
}

// ── observations ──────────────────────────────────────────────────────────────
export type Observation = {
  id: string;
  title: string;
  body: string;
  observedOn: string;
  author: string;
  photoUrl: string | null;
  goals: { id: string; code: string }[];
};

export async function getObservations(childId: string): Promise<Observation[]> {
  const ctx = await studentContext(childId);
  if (!ctx) return [];
  const { service } = ctx;

  const { data } = await service
    .from('observations')
    .select('id, title, body, observed_on, photo_path, users(full_name), observation_goals(framework_goals(id, code))')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('observed_on', { ascending: false });

  const rows = data ?? [];
  const out: Observation[] = [];
  for (const o of rows) {
    const author = Array.isArray(o.users) ? o.users[0] : o.users;
    const goals = ((o.observation_goals ?? []) as { framework_goals: { id: string; code: string } | { id: string; code: string }[] | null }[])
      .map((g) => (Array.isArray(g.framework_goals) ? g.framework_goals[0] : g.framework_goals))
      .filter((g): g is { id: string; code: string } => !!g);
    out.push({
      id: o.id,
      title: o.title,
      body: o.body,
      observedOn: o.observed_on,
      author: author?.full_name ?? 'Staff',
      photoUrl: o.photo_path ? await getStudentDocSignedUrl(o.photo_path).catch(() => null) : null,
      goals,
    });
  }
  return out;
}

export async function createObservation(childId: string, formData: FormData): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx) throw new Error('Forbidden');
  const { service, userId, centerId } = ctx;

  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const observedOn = String(formData.get('observedOn') ?? '') || new Date().toISOString().slice(0, 10);
  const goalIds = JSON.parse(String(formData.get('goalIds') ?? '[]')) as string[];
  if (!title || !body) throw new Error('Title and note are required');

  // Photo only if the child has media consent.
  let photoPath: string | null = null;
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const { data: child } = await service.from('children').select('photo_consent, classroom_id').eq('id', childId).single();
    if (child?.photo_consent) photoPath = await uploadStudentDocFile(childId, photo);
  }
  const { data: child } = await service.from('children').select('classroom_id').eq('id', childId).single();

  const { data: obs, error } = await service
    .from('observations')
    .insert({ child_id: childId, center_id: centerId, classroom_id: child?.classroom_id ?? null, observed_by: userId, observed_on: observedOn, title, body, photo_path: photoPath })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  if (goalIds.length) {
    await service.from('observation_goals').insert(goalIds.map((goal_id) => ({ observation_id: obs.id, goal_id })));
  }
  revalidatePath(`/students/${childId}`);
}

export async function deleteObservation(childId: string, obsId: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx) throw new Error('Forbidden');
  await ctx.service.from('observations').update({ deleted_at: new Date().toISOString() }).eq('id', obsId).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}

// ── checkpoints (assessment) ────────────────────────────────────────────────
export type CheckpointSummary = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'submitted' | 'locked';
  ratedCount: number;
};

export async function getCheckpoints(childId: string): Promise<CheckpointSummary[]> {
  const ctx = await studentContext(childId);
  if (!ctx) return [];
  const { service } = ctx;
  const { data } = await service
    .from('checkpoints')
    .select('id, period_label, period_start, period_end, status, checkpoint_ratings(count)')
    .eq('child_id', childId)
    .order('period_start', { ascending: false });
  return (data ?? []).map((c) => {
    const ratings = c.checkpoint_ratings as unknown as { count: number }[] | null;
    return {
      id: c.id,
      periodLabel: c.period_label,
      periodStart: c.period_start,
      periodEnd: c.period_end,
      status: c.status as CheckpointSummary['status'],
      ratedCount: ratings?.[0]?.count ?? 0,
    };
  });
}

export async function createCheckpoint(childId: string, periodLabel: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, centerId } = ctx;
  const sctx = await getSaeoContext(childId);
  if (!sctx?.frameworkId || !sctx.hasFramework) throw new Error('No framework available for this age');

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
  const label = periodLabel.trim() || start;

  const { error } = await service.from('checkpoints').insert({
    child_id: childId,
    center_id: centerId,
    framework_id: sctx.frameworkId,
    view: sctx.view,
    period_label: label,
    period_start: start,
    period_end: end,
    status: 'draft',
  });
  if (error) throw new Error(error.code === '23505' ? `A checkpoint named "${label}" already exists.` : error.message);
  revalidatePath(`/students/${childId}`);
}
