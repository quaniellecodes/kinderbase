'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceClient>;

async function directorOf(service: Service, userId: string, centerId: string): Promise<boolean> {
  const { data } = await service.from('center_memberships').select('role').eq('user_id', userId).eq('center_id', centerId).is('left_at', null).maybeSingle();
  return data?.role === 'director';
}

/**
 * Open a read-only emulation of a child's family (PARENT-DECISIONS §7c). Owner/
 * director only; always audited. Redirects into the parent app, where the
 * effective principal (parentContext) resolves to this family with every write
 * refused.
 */
export async function startEmulation(childId: string): Promise<void> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) throw new Error('Forbidden');
  const service = createServiceClient();

  const { data: child } = await service.from('children').select('center_id, is_sample').eq('id', childId).maybeSingle();
  if (!child) throw new Error('Not found');
  if (!(await directorOf(service, user.id, child.center_id))) throw new Error('Forbidden');

  const { data: g } = await service.from('guardians').select('id').eq('child_id', childId).order('is_primary', { ascending: false }).limit(1).maybeSingle();

  // One open session at a time per viewer.
  await service.from('emulation_sessions').update({ ended_at: new Date().toISOString() }).eq('viewer_id', user.id).is('ended_at', null);
  await service.from('emulation_sessions').insert({ viewer_id: user.id, guardian_id: g?.id ?? null, child_id: childId, center_id: child.center_id, is_sample: child.is_sample });
  // Looking at one family's private view is a privacy event — always recorded.
  await service.from('activity_log').insert({ center_id: child.center_id, actor_id: user.id, event_type: 'parent.emulation_started', payload: { child_id: childId, sample: child.is_sample } });

  redirect('/p');
}

/** Open the admin-only sample family for this center (§7c). */
export async function startSampleEmulation(centerId: string): Promise<void> {
  const service = createServiceClient();
  const { data: sample } = await service.from('children').select('id').eq('center_id', centerId).eq('is_sample', true).limit(1).maybeSingle();
  if (!sample) throw new Error('No sample family for this center');
  await startEmulation(sample.id);
}

/** End the current emulation and return to the staff app. Audited. */
export async function endEmulation(): Promise<void> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');
  const service = createServiceClient();
  const { data: open } = await service.from('emulation_sessions').select('id, center_id').eq('viewer_id', user.id).is('ended_at', null).maybeSingle();
  if (open) {
    await service.from('emulation_sessions').update({ ended_at: new Date().toISOString() }).eq('id', open.id);
    await service.from('activity_log').insert({ center_id: open.center_id, actor_id: user.id, event_type: 'parent.emulation_ended', payload: {} });
  }
  redirect('/dashboard');
}
