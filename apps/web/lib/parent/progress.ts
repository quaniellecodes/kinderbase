import 'server-only';
import { redactNames } from '@kinderbase/core';
import { parentContext } from './principal';

// The Progress tab (docs/PARENT-DECISIONS.md §2). Observations are LIVE — a note a
// teacher tagged to a goal shows as it happens. Checkpoint RATINGS are not: they
// appear only once a checkpoint is released. No scores, percentiles, or comparisons
// — just what was seen and which checkpoints have been shared. All free text is
// scrubbed of other children's names before it leaves the server.

export type ProgressMoment = { id: string; title: string | null; body: string; on: string; author: string };
export type ReleasedCheckpoint = { id: string; label: string; releasedOn: string };
export type ParentProgress = {
  childFirst: string;
  released: ReleasedCheckpoint[];
  moments: ProgressMoment[];
};

export async function getParentProgress(): Promise<ParentProgress | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const svc = p.service;
  const childId = p.activeChildId;

  const { data: child } = await svc.from('children').select('first_name, preferred_name, classroom_id').eq('id', childId).maybeSingle();
  if (!child) return null;

  // Names to redact: the room's other children (a body can name a classmate).
  const { data: roommates } = child.classroom_id
    ? await svc.from('children').select('first_name, preferred_name').eq('classroom_id', child.classroom_id).neq('id', childId)
    : { data: [] as { first_name: string; preferred_name: string | null }[] };
  const otherNames = (roommates ?? []).flatMap((r) => [r.first_name, r.preferred_name]).filter((n): n is string => !!n);

  // Observations (SAEO) — live. title + body are free text → scrub both.
  const { data: obs } = await svc
    .from('observations')
    .select('id, title, body, observed_on, users(full_name)')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('observed_on', { ascending: false })
    .limit(40);
  const moments: ProgressMoment[] = (obs ?? []).map((o) => ({
    id: o.id,
    title: o.title ? redactNames(o.title, otherNames) : null,
    body: redactNames(o.body, otherNames),
    on: o.observed_on,
    author: (Array.isArray(o.users) ? o.users[0] : o.users)?.full_name ?? 'Staff',
  }));

  // Voice/goal-tagged observations are posted as `child_updates` (type milestone),
  // not the observations table — include those too so Progress is complete.
  const { data: links } = await svc
    .from('child_update_children')
    .select('child_updates(id, update_type, body, created_at, users(full_name))')
    .eq('child_id', childId);
  type UpdRow = { id: string; update_type: string; body: string; created_at: string | null; users: { full_name: string } | { full_name: string }[] | null };
  for (const l of links ?? []) {
    const u = (Array.isArray(l.child_updates) ? l.child_updates[0] : l.child_updates) as UpdRow | null;
    if (!u || u.update_type !== 'milestone' || !u.created_at) continue;
    moments.push({ id: `u:${u.id}`, title: null, body: redactNames(u.body, otherNames), on: u.created_at.slice(0, 10), author: (Array.isArray(u.users) ? u.users[0] : u.users)?.full_name ?? 'Staff' });
  }
  moments.sort((a, b) => b.on.localeCompare(a.on));

  // Checkpoints — only once RELEASED (the family-facing gate).
  const { data: cps } = await svc
    .from('checkpoints')
    .select('id, period_label, released_at')
    .eq('child_id', childId)
    .not('released_at', 'is', null)
    .order('released_at', { ascending: false });
  const released: ReleasedCheckpoint[] = (cps ?? []).map((c) => ({ id: c.id, label: c.period_label, releasedOn: c.released_at! }));

  return { childFirst: child.preferred_name ?? child.first_name, released, moments };
}
