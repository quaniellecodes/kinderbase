import 'server-only';
import { redactNames } from '@kinderbase/core';
import { getClock } from '@/lib/clock';
import { clockTime } from '@/lib/format';
import { parentContext } from './principal';

// The scrubbed parent feed (docs/PARENT-DECISIONS.md §1). Parents have NO direct
// RLS read on child_updates — their free-text bodies can name a classmate and RLS
// can't rewrite text. This server reader fetches via the service client, then
// redacts every OTHER child's name from each body before it leaves the server.
// "Moments" are milestone/observation posts; "care" is meals/naps/incidents.

export type FeedMoment = { id: string; body: string; at: string; author: string };
export type FeedCare = { id: string; type: string; emoji: string; label: string; body: string; at: string };
export type ParentFeedDay = { key: string; label: string; moments: FeedMoment[]; care: FeedCare[] };
export type ParentFeed = {
  childFirst: string;
  room: string;
  signedInLabel: string | null;
  announcement: string | null;
  days: ParentFeedDay[];
};

const CARE_META: Record<string, { emoji: string; label: string }> = {
  meal: { emoji: '🥣', label: 'Meal' },
  nap: { emoji: '😴', label: 'Nap' },
  incident: { emoji: '⚠️', label: 'Incident' },
};

function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getParentFeed(): Promise<ParentFeed | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.childIds[0]!;
  const svc = p.service;

  const { data: child } = await svc
    .from('children')
    .select('first_name, preferred_name, center_id, classroom_id, classrooms(name)')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;
  const childFirst = child.preferred_name ?? child.first_name;
  const room = (Array.isArray(child.classrooms) ? child.classrooms[0] : child.classrooms)?.name ?? '';

  // Other children in the room → the names to redact from free-text bodies. (A
  // body can name a classmate who isn't even tagged, so scrub against the roster,
  // not just the tagged set.)
  const { data: roommates } = child.classroom_id
    ? await svc.from('children').select('id, first_name, preferred_name').eq('classroom_id', child.classroom_id).neq('id', childId)
    : { data: [] as { id: string; first_name: string; preferred_name: string | null }[] };
  const otherNames = (roommates ?? []).flatMap((r) => [r.first_name, r.preferred_name]).filter((n): n is string => !!n);

  // Updates tagged to this child (service client; parents can't read these directly).
  const { data: links } = await svc
    .from('child_update_children')
    .select('child_updates(id, update_type, body, created_at, users(full_name))')
    .eq('child_id', childId);
  type UpdRow = { id: string; update_type: string; body: string; created_at: string | null; users: { full_name: string } | { full_name: string }[] | null };
  const updates = (links ?? [])
    .map((l) => (Array.isArray(l.child_updates) ? l.child_updates[0] : l.child_updates) as UpdRow | null)
    .filter((u): u is UpdRow => !!u && !!u.created_at);

  // Today's sign-in, and the latest announcement.
  const now = getClock().now();
  const today = localDate(now.toISOString());
  const { data: att } = await svc.from('child_attendance').select('signed_in_at').eq('child_id', childId).eq('attendance_date', today).maybeSingle();
  const { data: ann } = await svc.from('announcements').select('body').eq('center_id', child.center_id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  // Group by day, scrubbing each body to this family.
  const byDay = new Map<string, ParentFeedDay>();
  for (const u of updates) {
    const key = localDate(u.created_at!);
    if (!byDay.has(key)) byDay.set(key, { key, label: dayLabel(key, today), moments: [], care: [] });
    const day = byDay.get(key)!;
    const author = (Array.isArray(u.users) ? u.users[0] : u.users)?.full_name ?? 'Staff';
    const body = redactNames(u.body, otherNames);
    if (u.update_type === 'milestone') {
      day.moments.push({ id: u.id, body, at: u.created_at!, author });
    } else {
      const meta = CARE_META[u.update_type] ?? { emoji: '📝', label: u.update_type };
      day.care.push({ id: u.id, type: u.update_type, emoji: meta.emoji, label: meta.label, body, at: u.created_at! });
    }
  }
  const days = [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key));

  return {
    childFirst,
    room,
    signedInLabel: att?.signed_in_at ? `signed in ${clockTime(att.signed_in_at)}` : null,
    announcement: ann?.body ?? null,
    days,
  };
}

function dayLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  const d = new Date(`${key}T12:00:00`);
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  if (key === `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
