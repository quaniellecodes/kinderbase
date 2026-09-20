'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { OPERATING_DAY_LABELS, slotToLabel, SLOTS_PER_DAY } from '@kinderbase/types';
import { Button, Card, Modal, Select } from '@/components/ui';
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
    <Card>
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

      <Modal open={editDay != null} onOpenChange={(o) => !o && setEditDay(null)} title={editDay != null ? `Edit ${OPERATING_DAY_LABELS[editDay]} shift` : undefined}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={start} onChange={(e) => setStart(Number(e.target.value))} className="flex-1">
              {OPEN_OPTS.map((s) => <option key={s} value={s}>{slotToLabel(s)}</option>)}
            </Select>
            <span className="text-gray-400">–</span>
            <Select value={end} onChange={(e) => setEnd(Number(e.target.value))} className="flex-1">
              {CLOSE_OPTS.map((s) => <option key={s} value={s}>{slotToLabel(s)}</option>)}
            </Select>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="md" onClick={() => save(true)} disabled={isSaving} className="text-red-500">Clear</Button>
            <div className="flex-1" />
            <Button variant="ghost" size="md" onClick={() => setEditDay(null)} className="text-gray-500">Cancel</Button>
            <Button onClick={() => save(false)} disabled={isSaving || end <= start}>{isSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
