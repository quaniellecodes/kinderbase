'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SCORE_SIGNALS, toStars, signalExplanation } from '@kinderbase/core';
import type { TeacherScoreRow } from '@kinderbase/types';
import { Stars } from './Stars';

type Props = {
  mode: 'admin' | 'employee';
  name: string;
  centerName: string;
  score: TeacherScoreRow | null;
  attendancePct: number;
};

export function StaffScore({ mode, name, centerName, score, attendancePct }: Props) {
  const [open, setOpen] = useState(false);

  const headline = mode === 'admin' ? score?.center_score ?? null : score?.teacher_visible_score ?? null;

  if (headline == null) {
    return (
      <p className="text-xs text-gray-400 mt-2">
        {mode === 'employee' ? 'Score available after 30 days' : 'No score computed yet'}
      </p>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-2 group">
        <Stars score={headline} />
        <span className="text-sm font-medium text-gray-900">{headline.toFixed(1)}</span>
        <span className="text-xs text-brand group-hover:underline">View breakdown →</span>
      </button>

      {open && score && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-card max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Score breakdown — {name}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <span className="text-4xl font-semibold text-gray-900">{headline.toFixed(1)}</span>
              <div>
                <Stars score={headline} size={18} />
                <p className="text-xs text-gray-500 mt-1">
                  {mode === 'admin' ? `Center score · ${centerName}` : `Your score · ${centerName}`}
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {SCORE_SIGNALS.map((sig) => {
                const sub = score[sig.field];
                return (
                  <div key={sig.key} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{sig.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {signalExplanation(sig.key, sub, mode === 'employee', { attendancePct })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                        {sub.toFixed(1)} <Stars score={sub} size={12} />
                      </p>
                      <p className="text-[11px] text-gray-400">{Math.round(sig.weight * 100)}% weight</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
