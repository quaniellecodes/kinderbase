import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getParentCalendar } from '@/lib/parent/calendar';

export const dynamic = 'force-dynamic';

export default async function ParentCalendarPage() {
  const cal = await getParentCalendar();
  if (!cal) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return (
    <div className="p-4">
      <Link href="/p/today" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2"><ChevronLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Calendar</h1>
      <p className="text-xs text-gray-500 mb-4">What&apos;s coming up at {cal.centerName}.</p>

      {cal.days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Nothing on the calendar right now.</div>
      ) : (
        <div className="space-y-4">
          {cal.days.map((d) => (
            <section key={d.key}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{d.label}</p>
              <div className="space-y-2">
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3" style={{ borderLeft: `3px solid ${e.colour}` }}>
                    <span className="text-base flex-shrink-0">{e.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900">{e.title}</p>
                      {(e.timeLabel || e.detail) && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{[e.timeLabel, e.detail].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
