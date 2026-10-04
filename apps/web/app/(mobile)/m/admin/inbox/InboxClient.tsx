'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, EmptyState, Button, toast, type BadgeTone } from '@/components/ui';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { resolveApproval, type Approval } from '../approvals-actions';
import type { ThreadGroups, ThreadSummary } from '../../messages/actions';

const KIND: Record<Approval['kind'], { label: string; tone: BadgeTone }> = {
  time: { label: 'Time correction', tone: 'green' },
  leave: { label: 'Sick day', tone: 'amber' },
  sched: { label: 'Schedule change', tone: 'blue' },
  plan: { label: 'Lesson plan', tone: 'purple' },
};
const toneCls: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', purple: 'bg-indigo-50 text-indigo-700',
  neutral: 'bg-gray-100 text-gray-600', red: 'bg-red-50 text-red-700', indigo: 'bg-indigo-50 text-indigo-700', sky: 'bg-sky-50 text-sky-700',
};
const AV_PALETTE = ['#D35400', '#185FA5', '#0F6E56', '#7B4FBB', '#993C1D', '#534AB7', '#1D9E75', '#854F0B'];
const avColor = (s: string) => AV_PALETTE[(s.charCodeAt(0) + (s.charCodeAt(1) || 0)) % AV_PALETTE.length];
const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

export function InboxClient({ approvals, threads }: { approvals: Approval[]; threads: ThreadGroups | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [seg, setSeg] = useState<'ap' | 'msg'>('ap');
  const [returnFor, setReturnFor] = useState<Approval | null>(null);
  const [comment, setComment] = useState('');

  const staff = (threads?.team ?? []).filter((t) => t.kind !== 'room');
  const families = threads?.families ?? [];
  const unreadMsgs = [...staff, ...families].filter((t) => t.unread).length;

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

  return (
    <div>
      {/* Header + tabs */}
      <div className="px-4 pt-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
        <div className="flex gap-6 mt-3">
          <SegTab active={seg === 'ap'} onClick={() => setSeg('ap')} label="Approvals" count={approvals.length} />
          <SegTab active={seg === 'msg'} onClick={() => setSeg('msg')} label="Messages" count={unreadMsgs} />
        </div>
      </div>

      {seg === 'ap' ? (
        <div className="p-4 space-y-2.5">
          {approvals.length === 0 ? (
            <Card padding="none"><EmptyState icon={<Inbox className="w-8 h-8" />} title="Inbox zero" description="Nothing waiting on you." /></Card>
          ) : (
            approvals.map((a) => {
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
                        <button onClick={() => toast('Opening the full week grid')} className="flex-1 text-[12px] font-semibold py-2 rounded-lg border border-gray-200 text-gray-700">Review</button>
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
            })
          )}
        </div>
      ) : (
        <div>
          {staff.length === 0 && families.length === 0 ? (
            <div className="p-4"><Card padding="none"><EmptyState icon={<Inbox className="w-8 h-8" />} title="No messages" description="Team and family threads appear here." /></Card></div>
          ) : (
            <>
              {staff.length > 0 && (
                <>
                  <GroupHead title="Staff" />
                  <div className="bg-white">{staff.map((t) => <ThreadRow key={t.id} t={t} />)}</div>
                </>
              )}
              {families.length > 0 && (
                <>
                  <GroupHead title="Families" right={<button onClick={() => toast('Broadcast to all families')} className="text-[11px] font-semibold text-brand">Message all</button>} />
                  <div className="bg-white">{families.map((t) => <ThreadRow key={t.id} t={t} />)}</div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <BottomSheet open={!!returnFor} onClose={() => setReturnFor(null)} title="Return lesson plan">
        <p className="text-[12px] text-gray-500 mb-2">Add a comment — the lead sees it and resubmits.</p>
        <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="e.g. Add a sensory option to Thursday's stations."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <Button className="w-full mt-3" onClick={submitReturn} disabled={pending}>{pending ? 'Returning…' : 'Return with comment'}</Button>
      </BottomSheet>
    </div>
  );
}

function SegTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-1.5 pb-2.5 -mb-px border-b-2 text-[13px] font-semibold', active ? 'text-brand border-brand' : 'text-gray-400 border-transparent')}>
      {label}
      {count > 0 && <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', active ? 'bg-brand text-white' : 'bg-status-red text-white')}>{count}</span>}
    </button>
  );
}

function GroupHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      {right}
    </div>
  );
}

function ThreadRow({ t }: { t: ThreadSummary }) {
  const emoji = t.kind === 'announcement' || t.kind === 'idea' || t.kind === 'room';
  const sqBg = t.kind === 'announcement' ? 'bg-brand' : 'bg-status-green';
  const hours = t.aging && t.lastAt ? Math.round((Date.now() - new Date(t.lastAt).getTime()) / 3_600_000) : 0;
  const meta =
    t.kind === 'announcement' ? 'Management · center announcement' : t.kind === 'idea' ? 'Idea Garden · staff suggestions' : t.kind === 'dm' ? t.sub || 'Direct message' : `${t.sub}${t.aging ? ' · awaiting a reply' : ' · staff replying'}`;
  return (
    <Link href={`/m/messages/${t.id}`} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50">
      {emoji ? (
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0', sqBg)}>{t.avatar}</div>
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0" style={{ background: avColor(t.name) }}>{initials(t.name)}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-gray-900 truncate">{t.name}</span>
          {t.kind === 'announcement' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 flex-shrink-0">Pinned</span>}
          {t.aging && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-status-red flex-shrink-0">No reply {hours}h</span>}
          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{fmtTime(t.lastAt)}</span>
        </div>
        <p className="text-[12px] text-gray-700 mt-0.5 line-clamp-2">{t.lastAuthor ? `${t.lastAuthor}: ` : ''}{t.lastBody}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta}</p>
      </div>
      {t.unread && <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5" />}
    </Link>
  );
}
