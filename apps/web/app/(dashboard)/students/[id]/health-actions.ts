'use server';

import { revalidatePath } from 'next/cache';
import { studentContext, isEditor, orNull } from '../access';

export type HealthKind = 'allergy' | 'medication' | 'diet' | 'condition';
export type HealthSeverity = '' | 'severe' | 'moderate' | 'mild' | 'prn';

export type HealthItem = {
  id: string;
  kind: HealthKind;
  name: string;
  detail: string;
  severity: HealthSeverity;
  rescueMed: string;
  rescueMedLocation: string;
  rescueMedExpires: string;
};

export type Physician = { id: string; name: string; practice: string; phone: string; lastVisit: string };

export type StudentHealth = { canEdit: boolean; items: HealthItem[]; physicians: Physician[] };

export async function getStudentHealth(childId: string): Promise<StudentHealth | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;

  const { data: items } = await service
    .from('student_health')
    .select('id, kind, name, detail, severity, rescue_med, rescue_med_location, rescue_med_expires')
    .eq('child_id', childId)
    .order('created_at');

  const { data: physicians } = await service
    .from('student_physicians')
    .select('id, name, practice, phone, last_visit')
    .eq('child_id', childId)
    .order('name');

  return {
    canEdit: isEditor(role),
    items: (items ?? []).map((h) => ({
      id: h.id,
      kind: h.kind as HealthKind,
      name: h.name,
      detail: h.detail ?? '',
      severity: (h.severity ?? '') as HealthSeverity,
      rescueMed: h.rescue_med ?? '',
      rescueMedLocation: h.rescue_med_location ?? '',
      rescueMedExpires: h.rescue_med_expires ?? '',
    })),
    physicians: (physicians ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      practice: p.practice ?? '',
      phone: p.phone ?? '',
      lastVisit: p.last_visit ?? '',
    })),
  };
}

type HealthInput = Omit<HealthItem, 'id'>;

function healthRow(input: HealthInput) {
  return {
    kind: input.kind,
    name: input.name.trim() || 'Untitled',
    detail: orNull(input.detail),
    severity: input.severity ? input.severity : null,
    rescue_med: orNull(input.rescueMed),
    rescue_med_location: orNull(input.rescueMedLocation),
    rescue_med_expires: input.rescueMedExpires || null,
  };
}

export async function addHealthItem(childId: string, input: HealthInput): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_health').insert({ child_id: childId, ...healthRow(input) });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function updateHealthItem(childId: string, id: string, input: HealthInput): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_health').update(healthRow(input)).eq('id', id).eq('child_id', childId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function deleteHealthItem(childId: string, id: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  await ctx.service.from('student_health').delete().eq('id', id).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}

type PhysicianInput = Omit<Physician, 'id'>;

function physicianRow(input: PhysicianInput) {
  return {
    name: input.name.trim() || 'Physician',
    practice: orNull(input.practice),
    phone: orNull(input.phone),
    last_visit: input.lastVisit || null,
  };
}

export async function addPhysician(childId: string, input: PhysicianInput): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_physicians').insert({ child_id: childId, ...physicianRow(input) });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function updatePhysician(childId: string, id: string, input: PhysicianInput): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_physicians').update(physicianRow(input)).eq('id', id).eq('child_id', childId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function deletePhysician(childId: string, id: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  await ctx.service.from('student_physicians').delete().eq('id', id).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}
