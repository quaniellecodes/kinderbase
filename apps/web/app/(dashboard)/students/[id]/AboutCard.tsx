'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Pencil } from 'lucide-react';
import { Card, Modal, Button, Badge, Textarea, Label, MultiSelectField } from '@/components/ui';
import { ABOUT_GROUPS } from '@/lib/students/about';
import { saveStudentAbout, type StudentAbout } from './about-schedule-actions';

export function AboutCard({ childId, name, about }: { childId: string; name: string; about: StudentAbout }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>(about.selections);
  const [note, setNote] = useState(about.note);
  const [pending, startTransition] = useTransition();

  const hasContent = Object.values(about.selections).some((v) => v.length > 0) || about.note.trim().length > 0;

  function openModal() {
    setSelections(about.selections);
    setNote(about.note);
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      await saveStudentAbout(childId, { selections, note });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="bg-amber-50 border-amber-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-amber-900">About {name.split(' ')[0]}</h2>
        </div>
        {about.canEdit && (
          <button onClick={openModal} className="text-amber-500 hover:text-amber-700" aria-label="Edit about">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!hasContent ? (
        <p className="text-xs text-amber-700/80">
          {about.canEdit ? 'Add what makes this child feel known — favorites, comfort, routines.' : 'No details recorded yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {ABOUT_GROUPS.map((g) => {
            const items = about.selections[g.key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={g.key}>
                <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">{g.label}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {items.map((i) => (
                    <Badge key={i} tone="amber" size="sm">
                      {i}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
          {about.note.trim() && <p className="text-xs text-amber-900/90 pt-1 border-t border-amber-100">{about.note}</p>}
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title={`About ${name.split(' ')[0]}`}>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {ABOUT_GROUPS.map((g) => (
            <div key={g.key}>
              <Label className="mb-1">{g.label}</Label>
              <MultiSelectField
                value={selections[g.key] ?? []}
                options={about.options[g.key] ?? []}
                onChange={(next) => setSelections((prev) => ({ ...prev, [g.key]: next }))}
                placeholder="Search or add…"
              />
            </div>
          ))}
          <div>
            <Label className="mb-1">Note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else the team should know" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
