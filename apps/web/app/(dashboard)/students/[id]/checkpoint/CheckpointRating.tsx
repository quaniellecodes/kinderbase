'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';
import { Card, Badge, Button, ProgressBar, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { GoalRatingRow } from './GoalRatingRow';
import { setCheckpointStatus, type CheckpointDetail } from './checkpoint-actions';

const STATUS_META: Record<CheckpointDetail['status'], { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'amber' },
  submitted: { label: 'Submitted', tone: 'green' },
  locked: { label: 'Locked', tone: 'neutral' },
};

export function CheckpointRating({ detail }: { detail: CheckpointDetail }) {
  const router = useRouter();
  const [activeDomain, setActiveDomain] = useState(detail.domains[0]?.code ?? '');
  const [pending, startTransition] = useTransition();

  const editable = detail.canEdit && detail.status === 'draft';
  const status = STATUS_META[detail.status];
  const domain = detail.domains.find((d) => d.code === activeDomain) ?? detail.domains[0];

  function submit() {
    startTransition(async () => {
      await setCheckpointStatus(detail.id, 'submitted');
      router.refresh();
    });
  }
  function reopen() {
    startTransition(async () => {
      await setCheckpointStatus(detail.id, 'draft');
      router.refresh();
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <Link href={`/students/${detail.childId}?tab=saeo&saeo=assessment`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> {detail.childName}
      </Link>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-gray-900">{detail.periodLabel}</h1>
            <Badge tone={status.tone} size="sm">{status.label}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {detail.view === 'infant_toddler' ? 'Infant/Toddler' : 'Preschool'} · {detail.ratedCount}/{detail.totalGoals} goals rated
          </p>
        </div>
        {detail.canEdit && (
          detail.status === 'draft' ? (
            <Button size="sm" className="gap-1.5" onClick={submit} disabled={pending}>
              <Lock className="w-3.5 h-3.5" /> Submit
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={reopen} disabled={pending}>
              <Unlock className="w-3.5 h-3.5" /> Reopen
            </Button>
          )
        )}
      </div>

      <ProgressBar value={detail.totalGoals ? (detail.ratedCount / detail.totalGoals) * 100 : 0} tone="brand" className="mb-4" />

      {!editable && (
        <p className="text-xs text-gray-400 mb-3">
          {detail.status !== 'draft' ? 'This checkpoint is submitted and read-only. Reopen it to make changes.' : 'You have read-only access to this checkpoint.'}
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        {/* Domain rail */}
        <div className="w-full md:w-56 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto">
            {detail.domains.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => setActiveDomain(d.code)}
                className={cn(
                  'text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap md:whitespace-normal transition-colors flex-shrink-0',
                  d.code === activeDomain ? 'bg-brand/10 text-brand font-medium' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <span className="text-[10px] font-semibold block opacity-70">{d.code}</span>
                {d.name}
              </button>
            ))}
          </div>
        </div>

        {/* Goals for the active domain */}
        <div className="flex-1 min-w-0 space-y-4">
          {domain?.subdomains.map((s) => (
            <Card key={s.name}>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">{s.name}</h2>
              <div className="divide-y divide-gray-50">
                {s.goals.map((g) => (
                  <GoalRatingRow key={g.id} cpId={detail.id} goal={g} ratingLevels={detail.ratingLevels} editable={editable} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
