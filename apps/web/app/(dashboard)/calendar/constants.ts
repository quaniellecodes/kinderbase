// Plain (non-"use server") module — palettes for the "New type" form, shared by
// the desktop and mobile calendar clients.
export const CAL_EMOJIS = ['📌', '🩺', '🎈', '🧾', '🎓', '🎨', '⚽', '📷', '🍎', '🐣'];
export const CAL_COLOURS = ['#D35400', '#E24B4A', '#EF9F27', '#1D9E75', '#185FA5', '#534AB7', '#7B4FBB', '#0F6E56', '#993C1D', '#5f5e5a'];

/** yyyy-mm-dd for the first/last day of a month (for getCalendar range fetches). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function longDate(iso: string): string {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
