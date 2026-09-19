'use client';

import { useRef } from 'react';
import { AGE_GROUP_LABELS, type AgeGroup, type ClassroomRow } from '@kinderbase/types';
import { createClassroom, updateClassroom } from '@/app/(dashboard)/classrooms/actions';

type Props = {
  centerId: string;
  classroom?: ClassroomRow;
  onDone: () => void;
};

const AGE_GROUPS = Object.entries(AGE_GROUP_LABELS) as [AgeGroup, string][];

export function ClassroomForm({ centerId, classroom, onDone }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

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
