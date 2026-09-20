'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Card, Textarea, type BadgeTone } from '@/components/ui';
import { NOTE_CATEGORY_LABELS, type NoteCategory } from '@kinderbase/types';
import { addStaffNote } from '@/app/(dashboard)/staff/[userId]/actions';
import type { StaffNote } from '@/app/(dashboard)/staff/[userId]/actions';

const CATEGORIES: NoteCategory[] = ['general', 'hr', 'performance_review', 'commendation', 'incident'];
const CATEGORY_TONE: Record<NoteCategory, BadgeTone> = {
  general: 'neutral',
  hr: 'blue',
  performance_review: 'purple',
  commendation: 'green',
  incident: 'red',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function NotesTab({ userId, userName, notes }: { userId: string; userName: string; notes: StaffNote[] }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('general');
  const [isSaving, startSave] = useTransition();

  function save() {
    if (!content.trim()) return;
    startSave(async () => { await addStaffNote(userId, content, category); setContent(''); setCategory('general'); router.refresh(); });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Admin notes</h2>
        <span className="text-xs text-gray-400">Visible to admins only</span>
      </div>

      <div className="divide-y divide-gray-100 mb-4">
        {notes.length === 0 && <p className="text-sm text-gray-400 py-3">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-3 py-3">
            <Avatar name={n.authorName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{n.authorName}</span> <span className="text-gray-400">· {fmt(n.createdAt)}</span>
              </p>
              <p className="text-sm text-gray-700 mt-0.5">{n.content}</p>
              <Badge tone={CATEGORY_TONE[n.category]} className="mt-1.5">{NOTE_CATEGORY_LABELS[n.category]}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[11px] px-2 py-0.5 rounded-chip font-medium ${category === c ? badgeToneRing(c) : 'bg-gray-100 text-gray-500'}`}
            >
              {NOTE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder={`Add a private admin note about ${userName}…`}
        />
        <Button onClick={save} disabled={isSaving || !content.trim()} size="lg" className="w-full py-2.5">
          {isSaving ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </Card>
  );
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  sky: 'bg-sky-50 text-sky-700',
};
function badgeToneRing(c: NoteCategory): string {
  return `${TONE_CLASS[CATEGORY_TONE[c]]} ring-1 ring-current`;
}
