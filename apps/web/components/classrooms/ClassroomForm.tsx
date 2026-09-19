'use client';

import { useRef, useState } from 'react';
import {
  AGE_GROUP_LABELS,
  OPERATING_DAY_LABELS,
  slotToLabel,
  type AgeGroup,
  type ClassroomRow,
} from '@kinderbase/types';
import { createClassroom, updateClassroom, type ClassroomHours } from '@/app/(dashboard)/classrooms/actions';
import { HoursFields } from '@/components/classrooms/HoursFields';

type Props = {
  centerId: string;
  classroom?: ClassroomRow;
  centerHours: ClassroomHours;
  canManageHours: boolean;
  onDone: () => void;
};

const AGE_GROUPS = Object.entries(AGE_GROUP_LABELS) as [AgeGroup, string][];

function summarize(open: number, close: number, days: number[]): string {
  const dayLabels = [...days].sort((a, b) => a - b).map((d) => OPERATING_DAY_LABELS[d]).join(', ');
  return `${slotToLabel(open)}–${slotToLabel(close)} · ${dayLabels || 'no days'}`;
}

export function ClassroomForm({ centerId, classroom, centerHours, canManageHours, onDone }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const overridden = classroom?.open_slot != null;
  const [custom, setCustom] = useState(overridden);
  const [openSlot, setOpenSlot] = useState(overridden ? (classroom!.open_slot as number) : centerHours.openSlot);
  const [closeSlot, setCloseSlot] = useState(overridden ? (classroom!.close_slot as number) : centerHours.closeSlot);
  const [days, setDays] = useState<number[]>(
    overridden ? (classroom!.operating_days as number[]) : centerHours.operatingDays
  );

  function toggleDay(day: number) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day].sort((a, b) => a - b)));
  }

  async function handleSubmit(formData: FormData) {
    if (classroom) {
      await updateClassroom(classroom.id, formData);
    } else {
      await createClassroom(formData);
    }
    onDone();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <input type="hidden" name="center_id" value={centerId} />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Room name</label>
        <input
          name="name"
          required
          defaultValue={classroom?.name}
          placeholder="e.g. Sunflower Room"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Age group</label>
        <select
          name="age_group"
          required
          defaultValue={classroom?.age_group}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
        >
          <option value="">Select age group</option>
          {AGE_GROUPS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Licensed capacity</label>
          <input
            name="licensed_capacity"
            type="number"
            required
            min={1}
            defaultValue={classroom?.licensed_capacity}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Typical enrollment</label>
          <input
            name="typical_enrollment"
            type="number"
            required
            min={0}
            defaultValue={classroom?.typical_enrollment ?? 0}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>

      {canManageHours && (
        <div className="border-t border-gray-100 pt-3">
          <input type="hidden" name="hours_mode" value={custom ? 'custom' : 'inherit'} />
          {custom && (
            <>
              <input type="hidden" name="open_slot" value={openSlot} />
              <input type="hidden" name="close_slot" value={closeSlot} />
              <input type="hidden" name="operating_days" value={days.join(',')} />
            </>
          )}
          <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
            <input type="checkbox" checked={!custom} onChange={(e) => setCustom(!e.target.checked)} />
            Use center default hours ({summarize(centerHours.openSlot, centerHours.closeSlot, centerHours.operatingDays)})
          </label>
          {custom && (
            <>
              <HoursFields
                openSlot={openSlot}
                closeSlot={closeSlot}
                days={days}
                onOpenSlot={setOpenSlot}
                onCloseSlot={setCloseSlot}
                onToggleDay={toggleDay}
              />
              {classroom && (
                <p className="text-[10px] text-amber-600 mt-2">
                  Narrowing a room&apos;s hours removes any staff shifts or child counts outside the new window.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 text-sm bg-brand text-white rounded-lg px-4 py-2 font-medium"
        >
          {classroom ? 'Save changes' : 'Add classroom'}
        </button>
      </div>
    </form>
  );
}
