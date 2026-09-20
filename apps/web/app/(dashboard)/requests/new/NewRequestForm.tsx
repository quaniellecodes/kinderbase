'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOwnRequest } from '../actions';
import type { StaffRequestType } from '@kinderbase/types';

const TYPES: { key: StaffRequestType; label: string }[] = [
  { key: 'schedule', label: 'Schedule change' },
  { key: 'time_correction', label: 'Time correction' },
  { key: 'leave', label: 'Leave' },
];

export function NewRequestForm({ initialType }: { initialType: StaffRequestType }) {
  const router = useRouter();
  const [type, setType] = useState<StaffRequestType>(initialType);
  const [details, setDetails] = useState('');
  const [forDate, setForDate] = useState('');
  const [isSaving, startSave] = useTransition();

  function submit() {
    if (!details.trim()) return;
    startSave(async () => {
      await createOwnRequest(type, details, forDate || undefined);
      router.push('/requests');
    });
  }

  return (
    <div className="bg-white rounded-card border border-gray-100 p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <div className="flex gap-1.5">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} className={`text-xs px-3 py-1.5 rounded-chip font-medium ${type === t.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Date (optional)</label>
        <input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Details</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Describe your request…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => router.back()} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
        <button onClick={submit} disabled={isSaving || !details.trim()} className="flex-1 text-sm bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50">
          {isSaving ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </div>
  );
}
