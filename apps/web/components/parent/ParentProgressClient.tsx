'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { ParentProgress, AreaDomain, JourneyEntry } from '@/lib/parent/progress';

// Progress with two views (PARENT-DECISIONS §2): Areas (domains + what she's working
// on now) and Journey (the full timeline). Read-only.
export function ParentProgressClient({ data }: { data: ParentProgress }) {
  const [tab, setTab] = useState<'areas' | 'journey'>('areas');

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Progress</h1>
          <p className="text-xs text-gray-500">{tab === 'areas' ? `What ${data.childFirst} is working on` : `Everything since ${data.childFirst} started`}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0">
          {(['areas', 'journey'] as const).map((v) => (
            <button key={v} onClick={() => setTab(v)} className={cn('px-3 py-1.5 rounded-lg text-[13px] font-semibold capitalize', tab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {tab === 'areas' ? <Areas data={data} /> : <Journey data={data} />}
    </div>
  );
}

function CheckpointBanner({ label, author, releasedOn }: { label: string; author: string; releasedOn: string }) {
  return (
    <div className="flex items-start gap-3 bg-[#E7F3EC] border border-[#BBD9C8] rounded-xl p-3">
      <span className="text-xl flex-shrink-0">🌱</span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0B5137] capitalize">{label}</p>
        <p className="text-[11px] text-[#2C6B52]">{author}&apos;s summary · released {formatDate(releasedOn)}</p>
      </div>
    </div>
  );
}

function Areas({ data }: { data: ParentProgress }) {
  return (
    <div className="space-y-3">
      {data.banner && <CheckpointBanner label={data.banner.label} author={data.banner.author} releasedOn={data.banner.releasedOn} />}
      {data.areas.map((a) => (
        <AreaCard key={a.code} a={a} />
      ))}
    </div>
  );
}

function AreaCard({ a }: { a: AreaDomain }) {
  return (
    <Link href={`/p/progress/${encodeURIComponent(a.code)}`} className="block bg-white border border-gray-100 rounded-xl p-3.5" style={{ borderLeft: `4px solid ${a.colour}` }}>
      <div className="flex items-center gap-2.5">
        <span className="text-xl flex-shrink-0">{a.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-gray-900">{a.name}</p>
          <p className="text-[11px] text-gray-400">{a.subtitle}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>

      {a.level != null && (
        <div className="flex gap-1 mt-2.5">
          {Array.from({ length: a.levelMax }).map((_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < a.level! ? a.colour : '#E5E7EB' }} />
          ))}
        </div>
      )}

      {a.now && (
        <p className="text-[13px] text-gray-700 mt-2">
          Now: <span className="font-semibold text-gray-900">{a.now}</span>
        </p>
      )}

      <p className="text-[11px] text-gray-400 mt-1.5">
        {a.momentsThisMonth > 0 ? `${a.momentsThisMonth} moment${a.momentsThisMonth > 1 ? 's' : ''} this month · last ${formatDate(a.lastOn!)}` : 'Nothing written down yet this month'}
      </p>
    </Link>
  );
}

function Journey({ data }: { data: ParentProgress }) {
  // Group timeline entries by year so older years get a divider (newest first).
  const groups: { year: string; entries: JourneyEntry[] }[] = [];
  for (const e of data.journey) {
    const year = e.on.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.entries.push(e);
    else groups.push({ year, entries: [e] });
  }

  return (
    <div>
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 mb-4 text-center">
        <span className="text-[13px] font-semibold text-gray-900">{data.monthsWithUs} month{data.monthsWithUs === 1 ? '' : 's'} with us</span>
        <span className="text-[13px] text-gray-400"> · {data.momentCount} moment{data.momentCount === 1 ? '' : 's'} recorded</span>
      </div>

      {data.journey.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Her teachers haven&apos;t written anything down yet.</div>
      ) : (
        groups.map((grp) => (
          <div key={grp.year}>
            <p className="text-[11px] font-semibold text-gray-400 tracking-wide mb-2 mt-2">{grp.year}</p>
            <div>
              {grp.entries.map((e, i) => (
                <TimelineRow key={entryKey(e, i)} e={e} last={i === grp.entries.length - 1} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function entryKey(e: JourneyEntry, i: number): string {
  return e.kind === 'origin' ? `origin-${i}` : `${e.kind}-${e.id}`;
}

function TimelineRow({ e, last }: { e: JourneyEntry; last: boolean }) {
  const dot =
    e.kind === 'observation' ? (
      <span className="w-2.5 h-2.5 rounded-full mt-3.5" style={{ background: e.colour }} />
    ) : e.kind === 'checkpoint' ? (
      <span className="w-5 h-5 rounded-full mt-2 bg-[#E7F3EC] border border-[#BBD9C8] flex items-center justify-center text-[11px]">🌱</span>
    ) : (
      <span className="w-5 h-5 rounded-full mt-2 bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px]">🏠</span>
    );

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0 w-5">
        {dot}
        {!last && <span className="w-px flex-1 bg-gray-200 my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        {e.kind === 'observation' ? (
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 mb-1">{formatDate(e.on)} · {e.author}</p>
            <p className="text-[13px] text-gray-900 leading-relaxed">{e.body}</p>
            {e.goalLabel && (
              <span className="inline-flex items-center gap-1 mt-2 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${e.colour}1a`, color: e.colour }}>
                {e.icon} {e.goalLabel}
              </span>
            )}
          </div>
        ) : e.kind === 'checkpoint' ? (
          <div className="bg-[#E7F3EC] border border-[#BBD9C8] rounded-xl p-3">
            <p className="text-[13px] font-semibold text-[#0B5137] capitalize">{e.label}</p>
            <p className="text-[11px] text-[#2C6B52]">{formatDate(e.on)} · {e.author}&apos;s summary</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
            <p className="text-[13px] font-semibold text-gray-900">Started at {e.centerName}</p>
            <p className="text-[11px] text-gray-500">{formatDate(e.on)} · {e.roomName}{e.ageLabel ? ` · ${e.ageLabel}` : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}
