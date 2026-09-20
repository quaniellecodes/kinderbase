'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, type BadgeTone } from '@/components/ui';
import { resolveRequest, type RequestRow } from './actions';

const TYPE_LABEL: Record<RequestRow['type'], string> = {
  schedule: 'Schedule change',
  time_correction: 'Time correction',
  leave: 'Leave',
};
const STATUS_TONE: Record<RequestRow['status'], BadgeTone> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
};

export function RequestsList({ rows, admin }: { rows: RequestRow[]; admin: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  function resolve(id: string, status: 'approved' | 'rejected') {
    start(async () => { await resolveRequest(id, status); router.refresh(); });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">No requests yet.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id} padding="compact">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{TYPE_LABEL[r.type]}</span>
            {admin && <span className="text-xs text-gray-500">· {r.staffName}</span>}
            <Badge tone={STATUS_TONE[r.status]} className="ml-auto">{r.status}</Badge>
          </div>
          {r.details && <p className="text-sm text-gray-600 mt-1">{r.details}</p>}
          <p className="text-[11px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
          {admin && r.status === 'pending' && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => resolve(r.id, 'approved')} disabled={isPending}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => resolve(r.id, 'rejected')} disabled={isPending}>Reject</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
