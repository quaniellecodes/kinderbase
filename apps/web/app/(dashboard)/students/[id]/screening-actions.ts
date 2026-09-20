'use server';

import { revalidatePath } from 'next/cache';
import { studentContext, isEditor } from '../access';

export type ScreeningOutcome = 'pass' | 'refer' | 'rescreen' | 'scheduled';

export type Screening = {
  id: string;
  instrument: string;
  intervalLabel: string;
  resultSummary: string;
  outcome: ScreeningOutcome;
  administeredBy: string;
  administeredOn: string;
  dueOn: string;
  superseded: boolean;
};

export type StudentScreenings = { canEdit: boolean; current: Screening[]; history: Screening[] };

export async function getScreenings(childId: string): Promise<StudentScreenings | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;

  const { data } = await service
    .from('screenings')
    .select('id, instrument, interval_label, result_summary, outcome, administered_on, due_on, superseded_by, users(full_name)')
    .eq('child_id', childId)
    .order('administered_on', { ascending: false, nullsFirst: false });

  const map = (r: NonNullable<typeof data>[number]): Screening => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return {
      id: r.id,
      instrument: r.instrument,
      intervalLabel: r.interval_label ?? '',
      resultSummary: r.result_summary,
      outcome: r.outcome as ScreeningOutcome,
      administeredBy: u?.full_name ?? '',
      administeredOn: r.administered_on ?? '',
      dueOn: r.due_on ?? '',
      superseded: !!r.superseded_by,
    };
  };

  const rows = (data ?? []).map(map);
  return {
    canEdit: isEditor(role),
    current: rows.filter((r) => !r.superseded),
    history: rows.filter((r) => r.superseded),
  };
}

export async function recordScreening(
  childId: string,
  input: { instrument: string; intervalLabel: string; resultSummary: string; outcome: ScreeningOutcome; administeredOn: string; dueOn: string; supersedesId?: string },
): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, centerId, userId } = ctx;

  const { data: created, error } = await service
    .from('screenings')
    .insert({
      child_id: childId,
      center_id: centerId,
      instrument: input.instrument.trim() || 'Screening',
      interval_label: input.intervalLabel.trim() || null,
      result_summary: input.resultSummary.trim() || '—',
      outcome: input.outcome,
      administered_by: userId,
      administered_on: input.administeredOn || null,
      due_on: input.dueOn || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  // Corrections: mark the prior result superseded (service role — screenings have
  // no UPDATE policy for normal clients by design).
  if (input.supersedesId) {
    await service.from('screenings').update({ superseded_by: created.id }).eq('id', input.supersedesId).eq('child_id', childId);
  }
  revalidatePath(`/students/${childId}`);
}
