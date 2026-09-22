'use client';

import { useState } from 'react';
import { Card, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StaffPerson, StudentPerson } from '../actions';

export function PeopleClient({ staff, students }: { staff: StaffPerson[]; students: StudentPerson[] }) {
  const [seg, setSeg] = useState<'staff' | 'students'>('staff');

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">People</h1>
      <div className="flex gap-5 border-b border-gray-100 mb-3">
        {(['staff', 'students'] as const).map((s) => (
          <button key={s} onClick={() => setSeg(s)} className={cn('text-[13px] font-semibold pb-2 border-b-2 capitalize', seg === s ? 'text-brand border-brand' : 'text-gray-400 border-transparent')}>
            {s} <span className="text-gray-300">{s === 'staff' ? staff.length : students.length}</span>
          </button>
        ))}
      </div>

      {seg === 'staff' ? (
        <Card padding="none" className="divide-y divide-gray-50">
          {staff.map((p) => (
            <div key={p.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-400">
                  <span className="text-amber-400">{'★'.repeat(Math.round(p.score))}</span>
                  <span className="text-gray-200">{'★'.repeat(5 - Math.round(p.score))}</span> {p.score.toFixed(1)} · {p.roleLabel}
                </p>
              </div>
              <Badge tone={p.lead ? 'blue' : 'amber'} size="sm">{p.lead ? 'Lead-qualified' : 'Aide'}</Badge>
            </div>
          ))}
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={s.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{s.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{s.room} · {s.ageLabel}</p>
              </div>
              {s.allergy && <Badge tone="red" size="sm">Severe allergy</Badge>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
