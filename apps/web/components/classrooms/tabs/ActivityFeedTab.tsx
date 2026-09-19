'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { UPDATE_TYPE_LABELS, type UpdateType } from '@kinderbase/types';
import { UpdateItem } from '@/components/children/UpdateItem';
import { postChildUpdate, type FeedUpdate } from '@/app/(dashboard)/classrooms/child-actions';

type Props = {
  classroomId: string;
  updates: FeedUpdate[];
  children: { id: string; name: string }[];
};

const FILTERS: ('all' | UpdateType)[] = ['all', 'meal', 'nap', 'milestone', 'incident'];
const FILTER_LABEL: Record<'all' | UpdateType, string> = {
  all: 'All',
  meal: 'Meals',
  nap: 'Naps',
  milestone: 'Milestones',
  incident: 'Incidents',
};
const TYPES: UpdateType[] = ['meal', 'nap', 'milestone', 'incident'];

export function ActivityFeedTab({ classroomId, updates, children }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | UpdateType>('all');
  const [composing, setComposing] = useState(false);
  const [type, setType] = useState<UpdateType>('meal');
  const [body, setBody] = useState('');
  const [tagged, setTagged] = useState<string[]>([]);
  const [isPosting, startPost] = useTransition();

  const shown = filter === 'all' ? updates : updates.filter((u) => u.type === filter);

  function toggleChild(id: string) {
    setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  function submit() {
    if (!body.trim()) return;
    startPost(async () => {
      await postChildUpdate(classroomId, { type, body, childIds: tagged });
      setBody(''); setTagged([]); setComposing(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500">Filter:</span>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-chip text-xs font-medium ${
              filter === f ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
        <button
          onClick={() => setComposing((c) => !c)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Post update
        </button>
      </div>

      {composing && (
        <div className="bg-white rounded-card border border-gray-100 p-4 mb-4 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2.5 py-1 rounded-chip text-xs font-medium ${type === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {UPDATE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened?"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleChild(c.id)}
                className={`px-2 py-0.5 rounded-chip text-[11px] font-medium ${tagged.includes(c.id) ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-500'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={isPosting || !body.trim()} className="text-sm bg-brand text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
              {isPosting ? 'Posting…' : 'Post'}
            </button>
            <button onClick={() => setComposing(false)} className="text-sm text-gray-500 px-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-gray-100 px-4 py-2">
        {shown.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No updates.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((u) => <UpdateItem key={u.id} update={u} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
