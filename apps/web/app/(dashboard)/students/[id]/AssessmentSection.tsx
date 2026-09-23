import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { Card, Badge, EmptyState, type BadgeTone } from '@/components/ui';
import { getCheckpoints, getSaeoContext, type CheckpointSummary } from './saeo-actions';
import { NewCheckpointButton } from './NewCheckpointButton';

const STATUS_META: Record<CheckpointSummary['status'], { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'amber' },
  submitted: { label: 'Submitted', tone: 'green' },
  locked: { label: 'Locked', tone: 'neutral' },
};

export async function AssessmentSection({ childId }: { childId: string }) {
  const [checkpoints, ctx] = await Promise.all([getCheckpoints(childId), getSaeoContext(childId)]);
  const canCreate = !!ctx?.canEdit && !!ctx?.hasFramework;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Assessment checkpoints</h2>
        {canCreate && <NewCheckpointButton childId={childId} />}
      </div>

      {checkpoints.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<ClipboardCheck className="w-7 h-7" />}
            title="No checkpoints yet"
            description={canCreate ? 'Create a checkpoint to rate ELOF goals for this period.' : 'Checkpoints rate ELOF goals each period.'}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {checkpoints.map((cp) => {
            const status = STATUS_META[cp.status];
            return (
              <Link key={cp.id} href={`/students/${childId}/checkpoint/${cp.id}`} className="block">
                <Card className="hover:border-brand/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{cp.periodLabel}</p>
                      <p className="text-xs text-gray-400">{cp.periodStart} → {cp.periodEnd}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge tone={status.tone} size="sm">{status.label}</Badge>
                      <p className="text-xs text-gray-400 mt-1">{cp.ratedCount} rated</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
