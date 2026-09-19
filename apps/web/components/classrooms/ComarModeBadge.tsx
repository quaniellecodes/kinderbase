'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { setRatioOverride } from '@/app/(dashboard)/classrooms/child-actions';
import type { ClassroomRatioInfo } from '@/app/(dashboard)/classrooms/actions';

type Props = {
  classroomId: string;
  ratio: ClassroomRatioInfo;
  canEdit: boolean;
};

export function ComarModeBadge({ classroomId, ratio, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cps, setCps] = useState(ratio.childrenPerStaff);
  const [maxg, setMaxg] = useState(ratio.maxGroup);
  const [isSaving, startSave] = useTransition();

  function save(override: { childrenPerStaff: number; maxGroup: number } | null) {
    startSave(async () => {
      await setRatioOverride(classroomId, override);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-card px-4 py-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Info className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-indigo-900">
          {ratio.mode === 'auto' ? 'Auto mode' : 'Manual mode'}
        </span>
        <span className="text-sm text-indigo-700">
          · ratio 1:{ratio.childrenPerStaff}, max group {ratio.maxGroup} · {ratio.citation}
        </span>
        {canEdit && !editing && (
          <button
            onClick={() => { setCps(ratio.childrenPerStaff); setMaxg(ratio.maxGroup); setEditing(true); }}
            className="ml-auto text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
          >
            {ratio.mode === 'auto' ? 'Switch to Manual' : 'Edit override'}
          </button>
        )}
        {canEdit && ratio.mode === 'manual' && !editing && (
          <button
            onClick={() => save(null)}
            disabled={isSaving}
            className="text-xs font-medium text-indigo-500 hover:text-indigo-700 underline disabled:opacity-50"
          >
            Reset to Auto
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-indigo-800">
            Children per staff
            <input
              type="number"
              min={1}
              value={cps}
              onChange={(e) => setCps(Math.max(1, parseInt(e.target.value) || 1))}
              className="ml-2 w-16 text-sm border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </label>
          <label className="text-xs text-indigo-800">
            Max group
            <input
              type="number"
              min={1}
              value={maxg}
              onChange={(e) => setMaxg(Math.max(1, parseInt(e.target.value) || 1))}
              className="ml-2 w-16 text-sm border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </label>
          <button
            onClick={() => save({ childrenPerStaff: cps, maxGroup: maxg })}
            disabled={isSaving}
            className="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save override'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-indigo-500">Cancel</button>
        </div>
      )}
    </div>
  );
}
