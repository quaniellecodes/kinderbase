'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, EmptyState, Button, type BadgeTone } from '@/components/ui';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { cn } from '@/lib/utils';
import { Inbox, MessageSquare, ChevronRight } from 'lucide-react';
import { resolveApproval, type Approval } from '../approvals-actions';
import type { AgingThread } from '../../messages/actions';

const KIND: Record<Approval['kind'], { label: string; tone: BadgeTone }> = {
  time: { label: 'Time correction', tone: 'green' },
  leave: { label: 'Leave', tone: 'amber' },
  sched: { label: 'Schedule', tone: 'blue' },
  plan: { label: 'Lesson plan', tone: 'purple' },
};
const toneCls: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', purple: 'bg-indigo-50 text-indigo-700',
  neutral: 'bg-gray-100 text-gray-600', red: 'bg-red-50 text-red-700', indigo: 'bg-indigo-50 text-indigo-700', sky: 'bg-sky-50 text-sky-700',
};

export function InboxClient({ approvals, aging = [] }: { approvals: Approval[]; aging?: AgingThread[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [returnFor, setReturnFor] = useState<Approval | null>(null);
  const [comment, setComment] = useState('');
  const total = approvals.length + aging.length;

  const familySection = aging.length > 0 && (
    <section className="mb-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Families waiting</p>
      <Card padding="none" className="divide-y divide-gray-50">
        {aging.map((a) => (
          <Link key={a.id} href={`/m/messages/${a.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-red-50 text-status-red flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-900 truncate">{a.childName}'s family · {a.room}</p>
              <p className="text-[11px] text-gray-500 truncate">{a.snippet}</p>
            </div>
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-50 text-status-red flex-shrink-0">{a.hours}h</span>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </Link>
        ))}
      </Card>
    </section>
  );

  function act(id: string, decision: 'approved' | 'rejected') {
    start(async () => {
      await resolveApproval(id, decision);
      router.refresh();
    });
  }
  function submitReturn() {
    if (!returnFor) return;
    start(async () => {
      await resolveApproval(returnFor.id, 'returned', comment.trim() || 'Please revise and resubmit.');
      setReturnFor(null);
      setComment('');
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Inbox</h1>
        <Card padding="none"><EmptyState icon={<Inbox className="w-8 h-8" />} title="Inbox zero" description="Nothing waiting on you." /></Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">Inbox <span className="text-sm text-gray-400">· {total}</span></h1>
      {familySection}
      {approvals.length > 0 && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Approvals</p>}
      <div className="space-y-2.5">
        {approvals.map((a) => {
          const k = KIND[a.kind];
          return (
            <Card key={a.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', toneCls[k.tone])}>{k.label}</span>
                <span className="text-[12px] font-semibold text-gray-900">{a.who}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{a.when ? new Date(a.when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
              </div>
              <p className="text-[13px] font-medium text-gray-900">{a.title}</p>
              {a.detail && <p className="text-[12px] text-gray-600 mt-0.5">{a.detail}</p>}
              {a.meta && <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1.5">{a.meta}</p>}
              <div className="flex gap-2 mt-2.5">
                {a.kind === 'plan' ? (
                  <>
                    <button onClick={() => { setReturnFor(a); setComment(''); }} disabled={pending} className="flex-1 text-[12px] font-semibold py-2 rounded-lg border border-red-200 text-red-600">Return</button>
                    <button onClick={() => act(a.id, 'approved')} disabled={pending} className="flex-1 text-[12px] font-semibold py-2 rounded-lg bg-status-green text-white">Approve</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => act(a.id, 'rejected')} disabled={pending} className="flex-1 text-[12px] font-semibold py-2 rounded-lg border border-red-200 text-red-600">Deny</button>
                    <button onClick={() => act(a.id, 'approved')} disabled={pending} className="flex-1 text-[12px] font-semibold py-2 rounded-lg bg-status-green text-white">Approve</button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <BottomSheet open={!!returnFor} onClose={() => setReturnFor(null)} title="Return lesson plan">
        <p className="text-[12px] text-gray-500 mb-2">Add a comment — the lead sees it and resubmits.</p>
        <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="e.g. Add a sensory option to Thursday's stations."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <Button className="w-full mt-3" onClick={submitReturn} disabled={pending}>{pending ? 'Returning…' : 'Return with comment'}</Button>
      </BottomSheet>
    </div>
  );
}
