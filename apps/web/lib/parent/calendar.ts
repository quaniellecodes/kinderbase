import 'server-only';
import { filterVisible, type CalItem } from '@kinderbase/core';
import { getClock } from '@/lib/clock';
import { localDate } from '@/lib/format';
import { parentContext } from './principal';

// The center calendar as a family sees it (docs/PARENT-DECISIONS.md §1/§6). Reuses
// the core family-audience filter: parents see only family-visible stored events
// (closures, trips, conferences, picture day, events) — never the staff-derived
// items (time-off, credential expiries, age transitions) and never another child's
// data. Read-only agenda of what's coming up.

export type ParentCalEntry = { id: string; date: string; title: string; detail?: string; timeLabel?: string; icon: string; colour: string };
export type ParentCalendar = { centerName: string; entries: ParentCalEntry[] };

export async function getParentCalendar(): Promise<ParentCalendar | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const svc = p.service;
  const { data: child } = await svc.from('children').select('center_id, centers(name)').eq('id', p.activeChildId).maybeSingle();
  if (!child) return null;
  const centerId = child.center_id;
  const centerName = (Array.isArray(child.centers) ? child.centers[0] : child.centers)?.name ?? '';

  // Types: built-ins (center_id null) + this center's custom types.
  const { data: types } = await svc
    .from('calendar_event_types')
    .select('key, colour, icon, visible_admin, visible_staff, visible_family')
    .or(`center_id.is.null,center_id.eq.${centerId}`);
  const byKey: Record<string, { key: string; visibleAdmin: boolean; visibleStaff: boolean; visibleFamily: boolean }> = {};
  const meta: Record<string, { icon: string; colour: string }> = {};
  for (const t of types ?? []) {
    byKey[t.key] = { key: t.key, visibleAdmin: t.visible_admin, visibleStaff: t.visible_staff, visibleFamily: t.visible_family };
    meta[t.key] = { icon: t.icon, colour: t.colour };
  }

  const now = getClock().now();
  const from = localDate(now);
  const to = localDate(new Date(now.getTime() + 60 * 86_400_000));
  const { data: events } = await svc
    .from('calendar_events')
    .select('id, title, detail, starts_on, time_label, calendar_event_types(key)')
    .eq('center_id', centerId)
    .gte('starts_on', from)
    .lte('starts_on', to)
    .order('starts_on');

  const items: CalItem[] = (events ?? []).map((e) => {
    const t = Array.isArray(e.calendar_event_types) ? e.calendar_event_types[0] : e.calendar_event_types;
    return { id: e.id, date: e.starts_on, typeKey: t?.key ?? '', title: e.title, detail: e.detail ?? undefined, timeLabel: e.time_label ?? undefined };
  });
  const visible = filterVisible(items, byKey, 'family');

  const entries: ParentCalEntry[] = visible
    .map((it) => ({
      id: it.id ?? it.date + it.title,
      date: it.date,
      title: it.title,
      detail: it.detail,
      timeLabel: it.timeLabel,
      icon: meta[it.typeKey]?.icon ?? '📅',
      colour: meta[it.typeKey]?.colour ?? '#6b7280',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { centerName, entries };
}
