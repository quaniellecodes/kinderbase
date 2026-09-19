import Link from 'next/link';
import { Users } from 'lucide-react';
import type { ClassroomRow } from '@kinderbase/types';
import type { RatioResult } from '@kinderbase/core';
import { AGE_GROUP_LABELS } from '@kinderbase/types';
import { RatioBadge } from './RatioBadge';

type Props = {
  classroom: ClassroomRow;
  ratio: RatioResult;
};

export function ClassroomCard({ classroom, ratio }: Props) {
  return (
    <Link
      href={`/classrooms/${classroom.id}`}
      className="block bg-white rounded-card border border-gray-100 px-4 py-3 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{classroom.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{AGE_GROUP_LABELS[classroom.age_group]}</p>
        </div>
        <RatioBadge status={ratio.status} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Users className="w-3 h-3" />
          <span>{classroom.typical_enrollment} / {classroom.licensed_capacity}</span>
        </div>
        <span className="text-xs text-gray-400">
          Needs {ratio.requiredStaff} staff · {ratio.childrenPerStaff}:1 ratio
        </span>
      </div>
    </Link>
  );
}
