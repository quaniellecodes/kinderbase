import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { DashboardRoom } from '@/app/(dashboard)/classrooms/child-actions';

export function OutOfRatioBanner({ rooms }: { rooms: DashboardRoom[] }) {
  const outOfRatio = rooms.filter((r) => r.status === 'violation');
  if (outOfRatio.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <p className="text-sm font-medium text-red-800">
          {outOfRatio.length === 1 ? '1 room is out of ratio' : `${outOfRatio.length} rooms are out of ratio`}
        </p>
      </div>
      <ul className="space-y-1.5">
        {outOfRatio.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-red-900">
              <span className="font-medium">{r.name}</span>
              <span className="text-red-700"> — {r.currentRatio} (needs {r.requiredRatio})</span>
            </span>
            <Link
              href={`/classrooms/${r.id}?tab=staffing`}
              className="text-xs font-medium text-red-700 hover:text-red-900 underline whitespace-nowrap"
            >
              Assign float
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
