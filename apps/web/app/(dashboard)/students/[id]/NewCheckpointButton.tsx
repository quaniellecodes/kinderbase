'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Modal, Button, Input, Label } from '@/components/ui';
import { createCheckpoint } from './saeo-actions';

export function NewCheckpointButton({ childId }: { childId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function create() {
    setError('');
    startTransition(async () => {
      try {
        await createCheckpoint(childId, label);
        setOpen(false);
        setLabel('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create checkpoint');
      }
    });
  }

  return (
    <>
      <Button size="sm" className="gap-1" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> New checkpoint
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="New checkpoint">
        <div className="p-5 space-y-3">
          <div>
            <Label className="mb-1">Period label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Fall 2026" autoFocus />
          </div>
          <p className="text-xs text-gray-400">A 90-day rating period starting today. Goals come from the child’s ELOF view.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={create} disabled={pending}>{pending ? 'Creating…' : 'Create'}</Button>
        </div>
      </Modal>
    </>
  );
}
