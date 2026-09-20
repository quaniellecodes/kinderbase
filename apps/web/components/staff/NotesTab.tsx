'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_CHIP, type NoteCategory } from '@kinderbase/types';
import { addStaffNote } from '@/app/(dashboard)/staff/[userId]/actions';
import type { StaffNote } from '@/app/(dashboard)/staff/[userId]/actions';

const CATEGORIES: NoteCategory[] = ['general', 'hr', 'performance_review', 'commendation', 'incident'];

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
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
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
              <span className={`inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-chip ${NOTE_CATEGORY_CHIP[n.category]}`}>{NOTE_CATEGORY_LABELS[n.category]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`text-[11px] px-2 py-0.5 rounded-chip font-medium ${category === c ? NOTE_CATEGORY_CHIP[c] + ' ring-1 ring-current' : 'bg-gray-100 text-gray-500'}`}>
              {NOTE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder={`Add a private admin note about ${userName}…`}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button onClick={save} disabled={isSaving || !content.trim()} className="w-full text-sm bg-brand text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
          {isSaving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}
