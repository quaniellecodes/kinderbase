import 'server-only';
import { getClock } from '@/lib/clock';
import { localDate } from '@/lib/format';
import { parentContext } from './principal';

// Parent absence reporting (docs/PARENT-DECISIONS.md §6). A guardian reports the
// active child will be out on a date; it's stored in child_absences and surfaces to
// staff on the calendar. This reader lists the child's UPCOMING reported absences
// (today forward) so the parent can see and cancel what they've reported.

export type AbsenceReason = 'sick' | 'vacation' | 'appointment' | 'other';
export const ABSENCE_REASONS: readonly AbsenceReason[] = ['sick', 'vacation', 'appointment', 'other'];
export type AbsenceEntry = { id: string; date: string; dateLabel: string; reason: AbsenceReason; note: string | null };
export type ParentAbsences = { childFirst: string; upcoming: AbsenceEntry[] };

function dayLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  const t = new Date(`${today}T12:00:00`);
  t.setDate(t.getDate() + 1);
  if (key === localDate(t)) return 'Tomorrow';
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export async function getParentAbsences(): Promise<ParentAbsences | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.activeChildId;
  const svc = p.service;

  const { data: child } = await svc.from('children').select('first_name, preferred_name').eq('id', childId).maybeSingle();
  if (!child) return null;

  const today = localDate(getClock().now());
  const { data: rows } = await svc
    .from('child_absences')
    .select('id, absent_on, reason, note')
    .eq('child_id', childId)
    .gte('absent_on', today)
    .order('absent_on');

  const upcoming: AbsenceEntry[] = (rows ?? []).map((r) => ({
    id: r.id,
    date: r.absent_on,
    dateLabel: dayLabel(r.absent_on, today),
    reason: (ABSENCE_REASONS as readonly string[]).includes(r.reason) ? (r.reason as AbsenceReason) : 'other',
    note: r.note,
  }));

  return { childFirst: child.preferred_name ?? child.first_name, upcoming };
}
