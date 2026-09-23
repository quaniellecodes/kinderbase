'use client';

import { useCallback } from 'react';
import { Card, PencilField } from '@/components/ui';
import { useDirtyForm } from '@/components/students/useDirtyForm';
import { DirtySaveBar } from '@/components/students/DirtySaveBar';
import { updateStudentInfo, type StudentInfo, type StudentInfoValues } from './student-detail-actions';

const SEX_OPTIONS = [
  { value: '', label: '—' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'graduated', label: 'Graduated' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">{title}</h2>
      <div className="divide-y divide-gray-50">{children}</div>
    </Card>
  );
}

export function InfoEditor({ childId, info }: { childId: string; info: StudentInfo }) {
  const onSave = useCallback((patch: Partial<StudentInfoValues>) => updateStudentInfo(childId, patch), [childId]);
  const form = useDirtyForm<StudentInfoValues>(info.values, onSave);
  const { values, setValue, isDirty } = form;
  const editable = info.canEdit;

  const bind = (key: keyof StudentInfoValues) => ({
    value: values[key] as string | string[] | boolean,
    dirty: isDirty(key),
    editable,
    onChange: (v: string | string[] | boolean) => setValue(key, v),
  });

  return (
    <div>
      <DirtySaveBar count={form.count} saving={form.saving} onDiscard={form.discard} onSave={form.save} />

      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
        <div>
          <SectionCard title="Identity">
            <PencilField label="Preferred name" {...bind('preferred_name')} placeholder="—" />
            <PencilField label="First name" {...bind('first_name')} />
            <PencilField label="Middle name" {...bind('middle_name')} />
            <PencilField label="Last name" {...bind('last_name')} />
            <PencilField label="Date of birth" type="date" {...bind('birthdate')} />
            <PencilField label="Sex" type="select" options={SEX_OPTIONS} {...bind('sex')} />
            <PencilField label="Student code" type="text" value={info.studentCode ?? ''} onChange={() => {}} editable={false} placeholder="Assigned on enrollment" />
          </SectionCard>

          <SectionCard title="Enrollment">
            <PencilField label="Status" type="select" options={STATUS_OPTIONS} {...bind('enrollment_status')} />
            <PencilField label="Classroom" type="select" options={info.classrooms} {...bind('classroom_id')} />
            <PencilField label="Primary language" {...bind('primary_language')} />
            <PencilField label="Home languages" type="multiselect" multiOptions={info.languageOptions} {...bind('home_languages')} />
            <PencilField label="Tags" type="multiselect" multiOptions={info.tagOptions} {...bind('tags')} />
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Address">
            <PencilField label="Street" {...bind('address_line1')} />
            <PencilField label="Apt / unit" {...bind('address_line2')} />
            <PencilField label="City" {...bind('city')} />
            <PencilField label="State" {...bind('state')} placeholder="MD" />
            <PencilField label="ZIP" {...bind('zip')} />
          </SectionCard>

          <SectionCard title="Consent & notes">
            <PencilField label="Photo / media consent" type="boolean" {...bind('photo_consent')} />
            {editable && <PencilField label="Admin notes (internal)" type="textarea" {...bind('admin_notes')} placeholder="Not visible to families" />}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
