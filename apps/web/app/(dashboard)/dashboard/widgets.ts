// Plain (non-"use server") module so these runtime values can be shared by the
// server actions and the client dashboard grid. A "use server" file may only
// export async functions. Widget catalogue + default layout for the director
// dashboard (docs/sessions/07-DESKTOP.md §2).

export type WidgetKey = 'strip' | 'kpi' | 'needs' | 'rooms' | 'heads' | 'acc' | 'staff' | 'approv' | 'feed';

export type WidgetDef = {
  key: WidgetKey;
  title: string;
  sub: string;
  defaultSpan: 1 | 2 | 3;
  defaultOn: boolean;
  /** bare widgets (strip, kpi) render without card chrome */
  bare?: boolean;
};

export const WIDGETS: WidgetDef[] = [
  { key: 'strip', title: 'Room compliance', sub: 'Every classroom at a glance', defaultSpan: 3, defaultOn: true, bare: true },
  { key: 'kpi', title: 'At a glance', sub: 'Center totals', defaultSpan: 3, defaultOn: true, bare: true },
  { key: 'needs', title: 'Waiting on you', sub: 'Approvals, replies, and gaps — most urgent first', defaultSpan: 3, defaultOn: true },
  { key: 'rooms', title: 'Rooms right now', sub: 'Governing rule and citation', defaultSpan: 2, defaultOn: true },
  { key: 'heads', title: 'Coming up', sub: 'Age transitions, credentials, documents', defaultSpan: 1, defaultOn: true },
  { key: 'acc', title: 'Update accountability', sub: 'Posts to families in the last 7 days', defaultSpan: 2, defaultOn: true },
  { key: 'staff', title: 'Staff today', sub: 'Late, floats, and subs', defaultSpan: 1, defaultOn: true },
  { key: 'approv', title: 'Needs your approval', sub: 'The queue', defaultSpan: 1, defaultOn: false },
  { key: 'feed', title: 'Latest updates', sub: 'Across every classroom', defaultSpan: 1, defaultOn: false },
];

export const WIDGET_BY_KEY: Record<WidgetKey, WidgetDef> = Object.fromEntries(WIDGETS.map((w) => [w.key, w])) as Record<WidgetKey, WidgetDef>;

export type WidgetLayoutRow = { widget_key: WidgetKey; sort_order: number; span: number; visible: boolean };

/** The default layout used when a director has no saved rows. */
export function defaultLayout(): WidgetLayoutRow[] {
  return WIDGETS.filter((w) => w.defaultOn).map((w, i) => ({ widget_key: w.key, sort_order: i, span: w.defaultSpan, visible: true }));
}
