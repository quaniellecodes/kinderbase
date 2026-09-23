'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Moon, Languages, AlertCircle } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ThreadGroups, ThreadSummary } from './actions';

function relTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MessagesClient({ data }: { data: ThreadGroups }) {
  const [tab, setTab] = useState<'team' | 'families'>('team');
  const list = tab === 'team' ? data.team : data.families;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Messages</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['team', 'families'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'families' && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-700 px-3 py-2 text-[11px]">
          <Moon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Quiet hours {data.quiet.start.slice(0, 5)}–{data.quiet.end.slice(0, 5)} — messages send at {data.quiet.end.slice(0, 5)}.</span>
        </div>
      )}

      {list.length === 0 ? (
        <Card padding="none">
          <EmptyState title={tab === 'team' ? 'No team channels yet' : 'No family threads yet'} description={tab === 'team' ? 'Announcements and room channels appear here.' : 'A thread opens for each enrolled child.'} />
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {list.map((t) => (
            <ThreadRow key={t.id} t={t} />
          ))}
        </Card>
      )}
    </div>
  );
}

function ThreadRow({ t }: { t: ThreadSummary }) {
  return (
    <Link href={`/m/messages/${t.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{t.avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[13px] truncate', t.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800')}>{t.name}</span>
          {t.lang && <Languages className="w-3 h-3 text-indigo-500 flex-shrink-0" />}
          {t.aging && <AlertCircle className="w-3 h-3 text-status-red flex-shrink-0" />}
          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{relTime(t.lastAt)}</span>
        </div>
        <p className={cn('text-[12px] truncate mt-0.5', t.unread ? 'text-gray-700' : 'text-gray-400')}>{t.lastBody}</p>
      </div>
      {t.unread && <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />}
    </Link>
  );
}
