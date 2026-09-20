'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Textarea, Label } from '@/components/ui';
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
    <Card className="space-y-3">
      <div>
        <Label>Type</Label>
        <div className="flex gap-1.5">
          {TYPES.map((t) => (
            <Button key={t.key} variant="chip" size="md" onClick={() => setType(t.key)} className={type === t.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}>
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label>Date (optional)</Label>
        <Input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
      </div>
      <div>
        <Label>Details</Label>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Describe your request…" />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => router.back()} className="flex-1">Cancel</Button>
        <Button size="lg" onClick={submit} disabled={isSaving || !details.trim()} className="flex-1">
          {isSaving ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </Card>
  );
}
