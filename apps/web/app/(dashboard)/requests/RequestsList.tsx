'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveRequest, type RequestRow } from './actions';

const TYPE_LABEL: Record<RequestRow['type'], string> = {
  schedule: 'Schedule change',
  time_correction: 'Time correction',
  leave: 'Leave',
};
const STATUS_CHIP: Record<RequestRow['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
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
        <div key={r.id} className="bg-white rounded-card border border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{TYPE_LABEL[r.type]}</span>
            {admin && <span className="text-xs text-gray-500">· {r.staffName}</span>}
            <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-chip font-medium ${STATUS_CHIP[r.status]}`}>{r.status}</span>
          </div>
          {r.details && <p className="text-sm text-gray-600 mt-1">{r.details}</p>}
          <p className="text-[11px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
          {admin && r.status === 'pending' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => resolve(r.id, 'approved')} disabled={isPending} className="text-xs bg-brand text-white rounded-lg px-3 py-1 font-medium disabled:opacity-60">Approve</button>
              <button onClick={() => resolve(r.id, 'rejected')} disabled={isPending} className="text-xs border border-gray-200 text-gray-600 rounded-lg px-3 py-1 disabled:opacity-60">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
