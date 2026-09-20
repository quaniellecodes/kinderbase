'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Pencil, ArrowRight } from 'lucide-react';
import { OPERATING_DAY_LABELS } from '@kinderbase/types';
import { Card, Modal, Button, Input, Label, Select, DayToggleRow } from '@/components/ui';
import { saveStudentSchedule, type StudentSchedule } from './about-schedule-actions';

function formatDays(days: number[]): string {
  if (days.length === 0) return 'No days set';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Mon–Fri';
  return [...days].sort((a, b) => a - b).map((d) => OPERATING_DAY_LABELS[d]).join(', ');
}

export function ScheduleCard({ childId, schedule }: { childId: string; schedule: StudentSchedule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>(schedule.days);
  const [dropoff, setDropoff] = useState(schedule.dropoffWindow);
  const [pickup, setPickup] = useState(schedule.pickupWindow);
  const [room, setRoom] = useState(schedule.transitionRoom);
  const [date, setDate] = useState(schedule.transitionDate);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setDays(schedule.days);
    setDropoff(schedule.dropoffWindow);
    setPickup(schedule.pickupWindow);
    setRoom(schedule.transitionRoom);
    setDate(schedule.transitionDate);
    setOpen(true);
  }

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function handleSave() {
    startTransition(async () => {
      await saveStudentSchedule(childId, {
        days,
        dropoffWindow: dropoff,
        pickupWindow: pickup,
        transitionRoom: room,
        transitionDate: date,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Schedule</h2>
        </div>
        {schedule.canEdit && (
          <button onClick={openModal} className="text-gray-300 hover:text-gray-600" aria-label="Edit schedule">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-400">Days</dt>
          <dd className="text-gray-900 text-right">{formatDays(schedule.days)}</dd>
        </div>
        {schedule.dropoffWindow && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Drop-off</dt>
            <dd className="text-gray-900 text-right">{schedule.dropoffWindow}</dd>
          </div>
        )}
        {schedule.pickupWindow && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Pickup</dt>
            <dd className="text-gray-900 text-right">{schedule.pickupWindow}</dd>
          </div>
        )}
      </dl>

      {schedule.transitionRoom && (
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5 text-xs text-gray-500">
          <ArrowRight className="w-3.5 h-3.5" />
          Moving to <span className="font-medium text-gray-700">{schedule.transitionRoom}</span>
          {schedule.transitionDate ? ` on ${schedule.transitionDate}` : ''}
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Schedule">
        <div className="p-5 space-y-4">
          <div>
            <Label className="mb-1.5">Attendance days</Label>
            <DayToggleRow value={days} onToggle={toggleDay} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">Drop-off window</Label>
              <Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="7:30–8:30 AM" />
            </div>
            <div>
              <Label className="mb-1">Pickup window</Label>
              <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="4:30–5:30 PM" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">Transition to room</Label>
              <Select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">None</option>
                {schedule.rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1">Transition date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
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
