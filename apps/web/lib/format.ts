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
