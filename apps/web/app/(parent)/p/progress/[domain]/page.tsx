import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { getParentArea } from '@/lib/parent/progress';
import { ProgressDetailShell } from '@/components/parent/ProgressDetailShell';

export const dynamic = 'force-dynamic';

export default async function ParentAreaPage({ params }: { params: { domain: string } }) {
  const domainCode = decodeURIComponent(params.domain);
  const area = await getParentArea(domainCode);
  if (!area) notFound();

  return (
    <ProgressDetailShell icon={area.icon} title={area.domainName} subtitle={area.subtitle} colour={area.colour}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">What {area.childFirst}&apos;s teachers watch for</p>
      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 mb-5">
        {area.goals.map((g) => (
          <Link key={g.id} href={`/p/progress/${encodeURIComponent(params.domain)}/${g.id}`} className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-gray-900">{g.label}</p>
              <p className="text-[11px] text-gray-400">{g.momentCount > 0 ? `${g.momentCount} moment${g.momentCount > 1 ? 's' : ''}` : 'nothing yet'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </Link>
        ))}
      </div>

      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent moments</p>
      {area.recentMoments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-[13px] text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-900">Nothing recorded in {area.domainName.toLowerCase()} this month.</span> That doesn&apos;t mean nothing happened — it means we haven&apos;t written anything down yet, and {area.childFirst}&apos;s teacher will know to look.
        </div>
      ) : (
        <div className="space-y-2">
          {area.recentMoments.map((m) => (
            <div key={m.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${area.colour}1a` }}>{m.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-500 mb-0.5"><span className="font-semibold text-gray-700">{m.author}</span> · {formatDate(m.on)}</p>
                <p className="text-[13px] text-gray-900 leading-relaxed">{m.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProgressDetailShell>
  );
}
