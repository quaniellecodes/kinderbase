'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rateGoal, type CheckpointGoal, type RatingLevel } from './checkpoint-actions';

export function GoalRatingRow({
  cpId,
  goal,
  ratingLevels,
  editable,
}: {
  cpId: string;
  goal: CheckpointGoal;
  ratingLevels: RatingLevel[];
  editable: boolean;
}) {
  const [levelId, setLevelId] = useState<string | null>(goal.ratingLevelId);
  const [note, setNote] = useState(goal.note);
  const [showNote, setShowNote] = useState(!!goal.note);
  const [savedTick, setSavedTick] = useState(false);
  const [, startTransition] = useTransition();

  function persist(nextLevel: string | null, nextNote: string) {
    startTransition(async () => {
      await rateGoal(cpId, goal.id, nextLevel, nextNote);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1200);
    });
  }

  function selectLevel(id: string) {
    if (!editable) return;
    const next = levelId === id ? null : id;
    setLevelId(next);
    persist(next, note);
  }

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-brand">{goal.code}</span>
            {savedTick && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                <Check className="w-3 h-3" /> saved
              </span>
            )}
          </div>
          {goal.text && <p className="text-sm text-gray-900 mt-0.5">{goal.text}</p>}
          {goal.progression?.descriptor && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium text-gray-600">{goal.progression.band}:</span> {goal.progression.descriptor}
            </p>
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className={cn('flex-shrink-0 p-1 rounded', showNote || note ? 'text-brand' : 'text-gray-300 hover:text-gray-500')}
            aria-label="Toggle note"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Rating segmented control */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {ratingLevels.map((lvl) => {
          const active = levelId === lvl.id;
          return (
            <button
              key={lvl.id}
              type="button"
              disabled={!editable}
              onClick={() => selectLevel(lvl.id)}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-chip border transition-colors disabled:cursor-default',
                active ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300',
                !editable && !active && 'opacity-60',
              )}
              style={active ? { backgroundColor: lvl.color } : undefined}
            >
              {lvl.label}
            </button>
          );
        })}
      </div>

      {(showNote || note) && (
        <textarea
          className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          rows={2}
          value={note}
          disabled={!editable}
          placeholder="Evidence or note (optional)"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== goal.note) persist(levelId, note);
          }}
        />
      )}

      {goal.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {goal.evidence.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-chip bg-indigo-50 text-indigo-700" title={e.observedOn}>
              <MessageSquare className="w-2.5 h-2.5" /> {e.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
