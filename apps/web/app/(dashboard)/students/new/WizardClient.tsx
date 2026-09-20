'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Card, Button, Input, Select, Label, MultiSelectField, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { createStudent, type NewStudentInput, type NewStudentOptions } from './new-actions';

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
];
const REL_OPTIONS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

const STEPS = ['Identity', 'Enrollment', 'Family', 'Review'];
const DRAFT_KEY = 'kb-new-student-draft';

const EMPTY: NewStudentInput = {
  firstName: '', middleName: '', lastName: '', preferredName: '', birthdate: '', sex: '',
  classroomId: '', enrollmentStatus: 'active', primaryLanguage: '', homeLanguages: [], tags: [],
  guardian: { fullName: '', relationship: 'mother', mobilePhone: '', email: '', isEmergency: true },
};

export function WizardClient({ options }: { options: NewStudentOptions }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewStudentInput>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Restore a saved draft on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setForm({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  // Persist the draft as the user types.
  useEffect(() => {
    if (loaded) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, loaded]);

  const set = <K extends keyof NewStudentInput>(key: K, value: NewStudentInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setGuardian = <K extends keyof NewStudentInput['guardian']>(key: K, value: NewStudentInput['guardian'][K]) =>
    setForm((f) => ({ ...f, guardian: { ...f.guardian, [key]: value } }));

  const step1Valid = form.firstName.trim() && form.lastName.trim() && form.birthdate;

  function submit() {
    setError('');
    startTransition(async () => {
      try {
        const { childId } = await createStudent(form);
        localStorage.removeItem(DRAFT_KEY);
        router.push(`/students/${childId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create student');
      }
    });
  }

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', i === step ? 'text-brand' : i < step ? 'text-gray-500' : 'text-gray-300')}>
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', i === step ? 'bg-brand text-white' : i < step ? 'bg-green-100 text-green-700' : 'bg-gray-100')}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="w-4 h-px bg-gray-200" />}
          </div>
        ))}
      </div>
      <ProgressBar value={((step + 1) / STEPS.length) * 100} tone="brand" className="mb-4" />

      <Card>
        {step === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1">First name *</Label><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus /></div>
              <div><Label className="mb-1">Last name *</Label><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
              <div><Label className="mb-1">Middle name</Label><Input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} /></div>
              <div><Label className="mb-1">Preferred name</Label><Input value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} /></div>
              <div><Label className="mb-1">Date of birth *</Label><Input type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} /></div>
              <div><Label className="mb-1">Sex</Label><Select value={form.sex} onChange={(e) => set('sex', e.target.value)}>{SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1">Classroom</Label><Select value={form.classroomId} onChange={(e) => set('classroomId', e.target.value)}>{options.classrooms.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              <div><Label className="mb-1">Status</Label><Select value={form.enrollmentStatus} onChange={(e) => set('enrollmentStatus', e.target.value as NewStudentInput['enrollmentStatus'])}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              <div><Label className="mb-1">Primary language</Label><Input value={form.primaryLanguage} onChange={(e) => set('primaryLanguage', e.target.value)} placeholder="English" /></div>
            </div>
            <div><Label className="mb-1">Home languages</Label><MultiSelectField value={form.homeLanguages} options={options.languageOptions} onChange={(v) => set('homeLanguages', v)} /></div>
            <div><Label className="mb-1">Tags</Label><MultiSelectField value={form.tags} options={options.tagOptions} onChange={(v) => set('tags', v)} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Add the primary guardian now — you can add more on the Family tab later.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1">Full name</Label><Input value={form.guardian.fullName} onChange={(e) => setGuardian('fullName', e.target.value)} /></div>
              <div><Label className="mb-1">Relationship</Label><Select value={form.guardian.relationship} onChange={(e) => setGuardian('relationship', e.target.value)}>{REL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              <div><Label className="mb-1">Mobile phone</Label><Input value={form.guardian.mobilePhone} onChange={(e) => setGuardian('mobilePhone', e.target.value)} /></div>
              <div><Label className="mb-1">Email</Label><Input value={form.guardian.email} onChange={(e) => setGuardian('email', e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.guardian.isEmergency} onChange={(e) => setGuardian('isEmergency', e.target.checked)} /> Emergency contact</label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <Row label="Name" value={`${form.firstName} ${form.middleName} ${form.lastName}`.replace(/\s+/g, ' ').trim() + (form.preferredName ? ` (“${form.preferredName}”)` : '')} />
            <Row label="Date of birth" value={form.birthdate || '—'} />
            <Row label="Classroom" value={options.classrooms.find((c) => c.value === form.classroomId)?.label ?? 'Unassigned'} />
            <Row label="Status" value={form.enrollmentStatus} />
            <Row label="Languages" value={[form.primaryLanguage, ...form.homeLanguages].filter(Boolean).join(', ') || '—'} />
            <Row label="Tags" value={form.tags.join(', ') || '—'} />
            <Row label="Guardian" value={form.guardian.fullName ? `${form.guardian.fullName} (${form.guardian.relationship})` : '— (add later)'} />
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">On create: a student code is generated, About + Schedule are initialized, and a current-period ELOF checkpoint is started when available for the age.</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button>
          ) : (
            <Link href="/students" className="text-sm text-gray-400 hover:text-gray-600">Cancel</Link>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !step1Valid} className="gap-1">Next <ArrowRight className="w-4 h-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={pending || !step1Valid}>{pending ? 'Creating…' : 'Create student'}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  );
}
