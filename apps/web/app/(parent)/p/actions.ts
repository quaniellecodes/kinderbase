'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getClock } from '@/lib/clock';
import { parentContext, assertReachable, assertCanWrite, hasPermission, ACTIVE_CHILD_COOKIE } from '@/lib/parent/principal';
import { ABSENCE_REASONS, localDate } from '@/lib/parent/absences';
import { isChangeField, changeSeverity } from '@/lib/change-requests';
import type { Json } from '@kinderbase/types/database';

// Multi-child switcher (PARENT-DECISIONS §1). Setting the active child is a cookie
// write, so it must happen in a Server Action, not a layout. We verify the child is
// actually reachable by this guardian before trusting the id from the client.
export async function switchChild(childId: string): Promise<void> {
  const p = await parentContext();
  if (!p) throw new Error('Not found');
  if (p.emulated) throw new Error('Emulation is single-child'); // never override the emulated child
  assertReachable(p, childId); // throws "Not found" for a child this guardian can't reach

  cookies().set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/p', 'layout');
}

// Report an absence for the active child (PARENT-DECISIONS §6). One row per child
// per day — re-reporting the same day updates the reason/note. Surfaces to staff on
// the calendar. Blocked while emulating (read-only).
export async function reportAbsence(absentOn: string, reason: string, note: string): Promise<void> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) throw new Error('Not found');
  assertCanWrite(p);
  const childId = p.activeChildId;
  const svc = p.service;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(absentOn)) throw new Error('Bad request');
  const today = localDate(getClock().now());
  if (absentOn < today) throw new Error('Pick today or a future date');
  const r = (ABSENCE_REASONS as readonly string[]).includes(reason) ? reason : 'other';

  const { data: child } = await svc.from('children').select('center_id').eq('id', childId).maybeSingle();
  if (!child) throw new Error('Not found');

  const { error } = await svc.from('child_absences').upsert(
    { child_id: childId, center_id: child.center_id, absent_on: absentOn, reason: r, note: note.trim() || null, reported_by: p.userId },
    { onConflict: 'child_id,absent_on' },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/p', 'layout');
}

// Cancel a reported absence. Scoped to the guardian's own children even though the
// service client bypasses RLS, so a guessed id can't delete another family's row.
export async function cancelAbsence(id: string): Promise<void> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) throw new Error('Not found');
  assertCanWrite(p);
  const { error } = await p.service.from('child_absences').delete().eq('id', id).in('child_id', p.childIds);
  if (error) throw new Error(error.message);
  revalidatePath('/p', 'layout');
}

// Propose a profile change (PARENT-DECISIONS §17). A guardian with `edit_record`
// files a PENDING request; nothing changes until an admin approves it. Major fields
// (birthday, removing a health item) are flagged for the admin. One open request per
// field+target — re-submitting replaces the previous one.
export async function requestProfileChange(input: {
  fieldKey: string;
  targetId: string | null;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  applyValue: Json | null;
}): Promise<void> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) throw new Error('Not found');
  assertCanWrite(p);
  const childId = p.activeChildId;
  if (!hasPermission(p, childId, 'edit_record')) throw new Error('You do not have permission to request changes.');
  if (!isChangeField(input.fieldKey)) throw new Error('Bad request');
  const severity = changeSeverity(input.fieldKey);
  const svc = p.service;

  const { data: child } = await svc.from('children').select('center_id').eq('id', childId).maybeSingle();
  if (!child) throw new Error('Not found');

  // Replace any existing open request for the same field+target.
  const del = svc.from('change_requests').delete().eq('child_id', childId).eq('field_key', input.fieldKey).eq('status', 'pending');
  await (input.targetId ? del.eq('target_id', input.targetId) : del.is('target_id', null));

  const { error } = await svc.from('change_requests').insert({
    child_id: childId,
    center_id: child.center_id,
    requested_by: p.userId,
    field_key: input.fieldKey,
    target_id: input.targetId,
    label: input.label,
    old_value: input.oldValue,
    new_value: input.newValue,
    apply_value: input.applyValue,
    severity,
    status: 'pending',
  });
  if (error) throw new Error(error.message);

  // "Notify" admins: an activity-log row + its presence in the approvals inbox.
  await svc.from('activity_log').insert({ center_id: child.center_id, actor_id: p.userId, event_type: 'profile.change_requested', payload: { child_id: childId, field: input.fieldKey, label: input.label, severity } });
  revalidatePath('/p', 'layout');
}

// Cancel a pending change request (the guardian's own child only).
export async function cancelProfileChange(id: string): Promise<void> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) throw new Error('Not found');
  assertCanWrite(p);
  const { error } = await p.service.from('change_requests').delete().eq('id', id).eq('status', 'pending').in('child_id', p.childIds);
  if (error) throw new Error(error.message);
  revalidatePath('/p', 'layout');
}
