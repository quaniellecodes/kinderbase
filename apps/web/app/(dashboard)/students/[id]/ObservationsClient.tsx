'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Camera, MessageSquare } from 'lucide-react';
import { Card, Modal, Button, Input, Textarea, Label, Badge, EmptyState, MultiSelectField } from '@/components/ui';
import { createObservation, deleteObservation, type Observation, type GoalOption } from './saeo-actions';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ObservationsClient({
  childId,
  observations,
  goalOptions,
  canEdit,
  photoConsent,
}: {
  childId: string;
  observations: Observation[];
  goalOptions: GoalOption[];
  canEdit: boolean;
  photoConsent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [observedOn, setObservedOn] = useState(today());
  const [codes, setCodes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const codeToId = new Map(goalOptions.map((g) => [g.code, g.id]));

  function reset() {
    setTitle(''); setBody(''); setObservedOn(today()); setCodes([]); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function save() {
    setError('');
    const fd = new FormData();
    fd.set('title', title);
    fd.set('body', body);
    fd.set('observedOn', observedOn);
    fd.set('goalIds', JSON.stringify(codes.map((c) => codeToId.get(c)).filter(Boolean)));
    const file = fileRef.current?.files?.[0];
    if (file) fd.set('photo', file);
    startTransition(async () => {
      try {
        await createObservation(childId, fd);
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save observation');
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Observations</h2>
        {canEdit && (
          <Button size="sm" className="gap-1" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> New observation
          </Button>
        )}
      </div>

      {observations.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No observations yet" description={canEdit ? 'Record anecdotal notes and tag the ELOF goals they show.' : undefined} />
        </Card>
      ) : (
        <div className="space-y-3">
          {observations.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{o.title}</p>
                  <p className="text-xs text-gray-400">{o.observedOn} · {o.author}</p>
                </div>
                {canEdit && (
                  <button onClick={() => { if (confirm('Delete this observation?')) startTransition(() => deleteObservation(childId, o.id).then(() => router.refresh())); }} className="text-gray-300 hover:text-red-500 flex-shrink-0" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{o.body}</p>
              {o.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.photoUrl} alt="" className="mt-2 rounded-lg max-h-48 object-cover" />
              )}
              {o.goals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {o.goals.map((g) => (
                    <Badge key={g.id} tone="indigo" size="sm">{g.code}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title="New observation">
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="mb-1">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Stacked four blocks" autoFocus /></div>
            <div className="col-span-2"><Label className="mb-1">What you observed</Label><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div><Label className="mb-1">Date</Label><Input type="date" value={observedOn} onChange={(e) => setObservedOn(e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-1">ELOF goals</Label>
            {goalOptions.length ? (
              <MultiSelectField value={codes} options={goalOptions.map((g) => g.code)} onChange={setCodes} allowAdd={false} placeholder="Tag goals by code (e.g. IT-C 3)…" />
            ) : (
              <p className="text-xs text-gray-400">No framework goals available for this age view yet.</p>
            )}
          </div>
          <div>
            <Label className="mb-1">Photo</Label>
            {photoConsent ? (
              <input ref={fileRef} type="file" accept="image/*" className="text-sm" />
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Photo disabled — no media consent on file.</p>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending || !title.trim() || !body.trim()}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      </Modal>
    </div>
  );
}
