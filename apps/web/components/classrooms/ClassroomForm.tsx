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
import { Input, Select, Label, Button } from '@/components/ui';

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
        <Label>Room name</Label>
        <Input
          name="name"
          required
          defaultValue={classroom?.name}
          placeholder="e.g. Sunflower Room"
        />
      </div>

      <div>
        <Label>Age group</Label>
        <Select
          name="age_group"
          required
          defaultValue={classroom?.age_group}
        >
          <option value="">Select age group</option>
          {AGE_GROUPS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Licensed capacity</Label>
          <Input
            name="licensed_capacity"
            type="number"
            required
            min={1}
            defaultValue={classroom?.licensed_capacity}
          />
        </div>
        <div>
          <Label>Typical enrollment</Label>
          <Input
            name="typical_enrollment"
            type="number"
            required
            min={0}
            defaultValue={classroom?.typical_enrollment ?? 0}
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
        <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1">
          {classroom ? 'Save changes' : 'Add classroom'}
        </Button>
      </div>
    </form>
  );
}
