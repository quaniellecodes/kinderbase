import Link from 'next/link';
import { Avatar } from '@/components/ui';
import { clockTime, formatDate } from '@/lib/format';
import { getParentFeed } from '@/lib/parent/feed';
import { getParentCalendar } from '@/lib/parent/calendar';

export const dynamic = 'force-dynamic';

export default async function ParentHomePage() {
  const [feed, cal] = await Promise.all([getParentFeed(), getParentCalendar()]);
  if (!feed) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  const upcoming = (cal?.entries ?? []).slice(0, 3);

  return (
    <div className="p-4 space-y-4">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <Avatar name={feed.childFirst} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-gray-900 truncate">{feed.childFirst}</div>
          <div className="text-xs text-gray-500 truncate">{feed.room}{feed.signedInLabel ? ` · ${feed.signedInLabel}` : ''}</div>
        </div>
      </div>

      {/* Announcements */}
      {feed.announcement && (
        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Announcements</p>
          <div className="flex gap-2.5 items-start bg-[#FFF4EC] border border-[#F3D3BC] rounded-xl p-3">
            <span className="text-base flex-shrink-0">📣</span>
            <p className="text-[13px] text-[#7A3A10] leading-snug">{feed.announcement}</p>
          </div>
        </section>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Coming up</p>
            <Link href="/p/calendar" className="text-[11px] font-semibold text-brand">See calendar ›</Link>
          </div>
          <div className="space-y-2">
            {upcoming.map((e) => (
              <Link key={e.id} href="/p/calendar" className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3" style={{ borderLeft: `3px solid ${e.colour}` }}>
                <span className="text-base flex-shrink-0">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900">{e.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{[formatDate(e.date), e.timeLabel].filter(Boolean).join(' · ')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Day-grouped moments + care */}
      {feed.days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          Nothing posted yet. Your child&apos;s moments and daily care will appear here.
        </div>
      ) : (
        feed.days.map((d) => (
          <section key={d.key}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{d.label}</p>
            <div className="space-y-2">
              {d.moments.map((m) => (
                <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-3">
                  <div className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">{m.author}</span> · {clockTime(m.at)}
                  </div>
                  <p className="text-[13px] text-gray-900 mt-1 leading-relaxed">{m.body}</p>
                </div>
              ))}
              {d.care.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {d.care.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="flex-shrink-0">{c.emoji}</span>
                      <span className="flex-1 text-[12px] text-gray-600 min-w-0">
                        <span className="font-semibold text-gray-900">{c.label}</span>
                        {c.body ? ` · ${c.body}` : ''}
                      </span>
                      <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">{clockTime(c.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
