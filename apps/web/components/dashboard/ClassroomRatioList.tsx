import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RatioStatus } from '@kinderbase/core';
import type { DashboardRoom } from '@/app/(dashboard)/classrooms/child-actions';

const dotColor: Record<RatioStatus, string> = {
  ok: 'bg-status-green',
  warning: 'bg-status-amber',
  violation: 'bg-status-red',
};

export function ClassroomRatioList({ rooms }: { rooms: DashboardRoom[] }) {
  if (rooms.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No classrooms yet.</p>;
  }
  return (
    <div className="space-y-2">
      {rooms.map((room) => (
        <Link
          key={room.id}
          href={`/classrooms/${room.id}`}
          className={`flex items-center gap-3 bg-white rounded-card border px-4 py-3 hover:border-gray-300 transition-colors ${
            room.status === 'violation' ? 'border-red-300' : 'border-gray-100'
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor[room.status]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {room.teachers.length ? room.teachers.join(', ') : 'No staff assigned'}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-medium ${room.status === 'violation' ? 'text-red-600' : 'text-gray-900'}`}>
              {room.currentRatio}
            </p>
            <p className="text-[11px] text-gray-400">req {room.requiredRatio}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
