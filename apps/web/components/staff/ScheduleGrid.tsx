'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { OPERATING_DAY_LABELS, slotToLabel, SLOTS_PER_DAY } from '@kinderbase/types';
import { updateScheduleDay } from '@/app/(dashboard)/staff/[userId]/actions';
import type { StaffSchedule } from '@/app/(dashboard)/staff/[userId]/actions';

const OPEN_OPTS = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i);
const CLOSE_OPTS = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i + 1);

export function ScheduleGrid({ userId, schedule, canEdit }: { userId: string; schedule: StaffSchedule; canEdit: boolean }) {
  const router = useRouter();
  const [editDay, setEditDay] = useState<number | null>(null);
  const [start, setStart] = useState(13);
  const [end, setEnd] = useState(31);
  const [isSaving, startSave] = useTransition();

  if (schedule.days.length === 0) {
    return <p className="text-sm text-gray-400">No room assignment yet — this staff member isn&apos;t on a classroom roster.</p>;
  }

  function openEditor(day: number, s: number | null, e: number | null) {
    setEditDay(day);
    setStart(s ?? 13);
    setEnd(e ?? 31);
  }
  function save(clear: boolean) {
    if (editDay == null || !schedule.rosterEntryId) return;
    startSave(async () => {
      await updateScheduleDay(userId, schedule.rosterEntryId!, editDay, clear ? null : start, clear ? null : end);
      setEditDay(null);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Weekly schedule — current period</h2>
        {schedule.roomName && <span className="text-xs text-gray-400">{schedule.roomName}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left font-medium py-1.5 pr-3 w-16">Shift</th>
              {schedule.days.map((d) => (
                <th key={d.day} className="text-center font-medium py-1.5 px-1">{OPERATING_DAY_LABELS[d.day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-gray-500 py-1.5 pr-3">Hours</td>
              {schedule.days.map((d) => (
                <td key={d.day} className="text-center px-1 py-1.5">
                  <button
                    disabled={!canEdit}
                    onClick={() => openEditor(d.day, d.startSlot, d.endSlot)}
                    className={`text-xs rounded-chip px-1.5 py-1 ${d.startSlot != null ? 'bg-green-50 text-green-700' : 'text-gray-300'} ${canEdit ? 'hover:ring-1 hover:ring-brand/40 cursor-pointer' : ''}`}
                  >
                    {d.startSlot != null ? `${slotToLabel(d.startSlot)}–${slotToLabel(d.endSlot)}` : '—'}
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <td className="text-gray-500 py-1.5 pr-3">Room</td>
              {schedule.days.map((d) => (
                <td key={d.day} className="text-center text-gray-600 text-xs px-1 py-1.5">
                  {d.startSlot != null ? schedule.roomName : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {editDay != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditDay(null)}>
          <div className="bg-white rounded-card max-w-xs w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-900">Edit {OPERATING_DAY_LABELS[editDay]} shift</h3>
            <div className="flex items-center gap-2">
              <select value={start} onChange={(e) => setStart(Number(e.target.value))} className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {OPEN_OPTS.map((s) => <option key={s} value={s}>{slotToLabel(s)}</option>)}
              </select>
              <span className="text-gray-400">–</span>
              <select value={end} onChange={(e) => setEnd(Number(e.target.value))} className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {CLOSE_OPTS.map((s) => <option key={s} value={s}>{slotToLabel(s)}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => save(true)} disabled={isSaving} className="text-sm text-red-500 px-2">Clear</button>
              <div className="flex-1" />
              <button onClick={() => setEditDay(null)} className="text-sm text-gray-500 px-2">Cancel</button>
              <button onClick={() => save(false)} disabled={isSaving || end <= start} className="text-sm bg-brand text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
