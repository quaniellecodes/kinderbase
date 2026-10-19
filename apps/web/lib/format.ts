/** "7:15 AM" from an ISO timestamp. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Compact relative time: "just now", "9:14 AM" (today), "3d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const isToday = new Date(iso).toDateString() === new Date().toDateString();
  if (isToday) return clockTime(iso);
  const days = Math.floor(mins / 1440);
  return `${days}d ago`;
}

/** Local-time yyyy-mm-dd for a Date (NOT toISOString, which is UTC). */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Sep 28" from an ISO date ("2026-09-28") or timestamp. */
export function formatDate(iso: string): string {
  // Date-only strings parse as UTC midnight; add noon so the local day is right.
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Week of Sep 28" — one place so no component hand-rolls toISOString().slice(). */
export function formatWeekOf(iso: string): string {
  return `Week of ${formatDate(iso)}`;
}

/** "Mon 29" style weekday label from an ISO date. */
export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

/** Hours as "7h 30m" (or "0m"). */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Accountability "Last posted": "Today, 9:14 AM", "Yesterday", or "11 days ago". Null → "No posts". */
export function formatLastPosted(iso: string | null): string {
  if (!iso) return 'No posts';
  const then = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - new Date(then.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return `Today, ${clockTime(iso)}`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
