'use server';

import { studentContext } from '../access';

export type ActivityItem = {
  id: string;
  kind: 'update' | 'signin' | 'signout';
  at: string; // ISO timestamp
  label: string;
  body: string;
  author: string;
};

export async function getStudentActivity(childId: string): Promise<ActivityItem[] | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service } = ctx;

  const { data: updateLinks } = await service
    .from('child_update_children')
    .select('child_updates(id, update_type, body, created_at, users(full_name))')
    .eq('child_id', childId);

  const { data: attendance } = await service
    .from('child_attendance')
    .select('id, attendance_date, signed_in_at, signed_out_at')
    .eq('child_id', childId)
    .order('attendance_date', { ascending: false })
    .limit(30);

  const items: ActivityItem[] = [];

  for (const link of updateLinks ?? []) {
    const u = Array.isArray(link.child_updates) ? link.child_updates[0] : link.child_updates;
    if (!u) continue;
    const author = Array.isArray(u.users) ? u.users[0] : u.users;
    items.push({
      id: `u:${u.id}`,
      kind: 'update',
      at: u.created_at,
      label: String(u.update_type ?? 'update').replace(/_/g, ' '),
      body: u.body ?? '',
      author: author?.full_name ?? 'Staff',
    });
  }

  for (const a of attendance ?? []) {
    if (a.signed_in_at) items.push({ id: `in:${a.id}`, kind: 'signin', at: a.signed_in_at, label: 'Signed in', body: '', author: '' });
    if (a.signed_out_at) items.push({ id: `out:${a.id}`, kind: 'signout', at: a.signed_out_at, label: 'Signed out', body: '', author: '' });
  }

  items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return items.slice(0, 80);
}
