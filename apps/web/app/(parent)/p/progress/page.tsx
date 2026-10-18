import { formatDate } from '@/lib/format';
import { getParentProgress } from '@/lib/parent/progress';

export const dynamic = 'force-dynamic';

export default async function ParentProgressPage() {
  const prog = await getParentProgress();
  if (!prog) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{prog.childFirst}&apos;s progress</h1>
        <p className="text-xs text-gray-500">Moments her teachers noticed — no scores, just what was seen.</p>
      </div>

      {/* Released checkpoints (ratings are shared only when a checkpoint is released) */}
      {prog.released.length > 0 && (
        <div className="space-y-2">
          {prog.released.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-[#E7F3EC] border border-[#BBD9C8] rounded-xl p-3">
              <span className="text-xl flex-shrink-0">🌱</span>
              <div>
                <p className="text-[13px] font-semibold text-[#0B5137]">{c.label}</p>
                <p className="text-[11px] text-[#2C6B52]">Released {formatDate(c.releasedOn)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Observations — live */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">What we&apos;ve seen</p>
        {prog.moments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            Her teachers haven&apos;t written anything down yet — observations will appear here as they happen.
          </div>
        ) : (
          <div className="space-y-2">
            {prog.moments.map((m) => (
              <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-700">{m.author}</span> · {formatDate(m.on)}
                </div>
                {m.title && <p className="text-[13px] font-semibold text-gray-900 mt-1">{m.title}</p>}
                <p className="text-[13px] text-gray-900 mt-0.5 leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
