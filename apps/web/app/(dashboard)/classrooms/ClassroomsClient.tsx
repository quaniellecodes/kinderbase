'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ClassroomRow } from '@kinderbase/types';
import type { RatioResult } from '@kinderbase/core';
import type { ClassroomHours } from '@/app/(dashboard)/classrooms/actions';
import { ClassroomCard } from '@/components/classrooms/ClassroomCard';
import { ClassroomForm } from '@/components/classrooms/ClassroomForm';

type Props = {
  centerId: string;
  classrooms: (ClassroomRow & { ratio: RatioResult })[];
  centerHours: ClassroomHours;
  canManageHours: boolean;
};

export function ClassroomsClient({ centerId, classrooms, centerHours, canManageHours }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-gray-900">Classrooms</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-brand text-white px-3 py-1.5 rounded-lg font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add room
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-card border border-gray-100 p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">New classroom</p>
          <ClassroomForm
            centerId={centerId}
            centerHours={centerHours}
            canManageHours={canManageHours}
            onDone={() => setShowForm(false)}
          />
        </div>
      )}

      {classrooms.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 text-center py-12">
          No classrooms yet. Add your first room to get started.
        </p>
      )}

      <div className="space-y-2">
        {classrooms.map(c => (
          <ClassroomCard key={c.id} classroom={c} ratio={c.ratio} />
        ))}
      </div>
    </div>
  );
}
