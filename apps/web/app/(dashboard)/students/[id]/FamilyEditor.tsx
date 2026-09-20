'use client';

import { useCallback, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Users } from 'lucide-react';
import { Card, PencilField, Badge, Button, EmptyState } from '@/components/ui';
import { useDirtyForm } from '@/components/students/useDirtyForm';
import { DirtySaveBar } from '@/components/students/DirtySaveBar';
import {
  saveFamily,
  addGuardian,
  deleteGuardian,
  addPickup,
  deletePickup,
  type StudentFamily,
  type GuardianRow,
  type PickupRow,
} from './student-detail-actions';

const REL_OPTIONS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

type FlatValues = Record<string, string | boolean>;

const GUARDIAN_STR: (keyof GuardianRow)[] = ['full_name', 'relationship', 'email', 'mobile_phone', 'employer', 'work_phone', 'custody_note'];
const GUARDIAN_BOOL: (keyof GuardianRow)[] = ['is_primary', 'is_emergency', 'is_pickup_restricted'];
const PICKUP_STR: (keyof PickupRow)[] = ['full_name', 'relationship', 'phone'];

function buildInitial(family: StudentFamily): FlatValues {
  const v: FlatValues = {};
  for (const g of family.guardians) {
    for (const k of GUARDIAN_STR) v[`g:${g.id}:${k}`] = g[k] as string;
    for (const k of GUARDIAN_BOOL) v[`g:${g.id}:${k}`] = g[k] as boolean;
  }
  for (const p of family.pickups) {
    for (const k of PICKUP_STR) v[`p:${p.id}:${k}`] = p[k] as string;
  }
  return v;
}

function reconstruct(patch: Partial<FlatValues>) {
  const guardians: Record<string, Partial<GuardianRow>> = {};
  const pickups: Record<string, Partial<PickupRow>> = {};
  for (const [key, value] of Object.entries(patch)) {
    const [kind, id, field] = key.split(':');
    if (kind === 'g') (guardians[id] ??= {})[field as keyof GuardianRow] = value as never;
    else if (kind === 'p') (pickups[id] ??= {})[field as keyof PickupRow] = value as never;
  }
  return { guardians, pickups };
}

export function FamilyEditor({ childId, family }: { childId: string; family: StudentFamily }) {
  const onSave = useCallback(
    (patch: Partial<FlatValues>) => saveFamily(childId, reconstruct(patch)),
    [childId],
  );
  const form = useDirtyForm<FlatValues>(buildInitial(family), onSave);
  const { values, setValue, isDirty } = form;
  const editable = family.canEdit;
  const [pending, startTransition] = useTransition();

  const bind = (key: string) => ({
    value: values[key],
    dirty: isDirty(key),
    editable,
    onChange: (v: string | string[] | boolean) => setValue(key, v as string | boolean),
  });

  return (
    <div>
      <DirtySaveBar count={form.count} saving={form.saving} onDiscard={form.discard} onSave={form.save} />

      {/* Guardians */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Guardians</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="gap-1" disabled={pending} onClick={() => startTransition(() => addGuardian(childId))}>
            <Plus className="w-3.5 h-3.5" /> Add guardian
          </Button>
        )}
      </div>
      {family.guardians.length === 0 ? (
        <Card padding="none" className="mb-4">
          <EmptyState icon={<Users className="w-7 h-7" />} title="No guardians yet" description={editable ? 'Add a guardian to record family contacts.' : undefined} />
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {family.guardians.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {g.is_primary && <Badge tone="blue" size="sm">Primary</Badge>}
                  {g.is_emergency && <Badge tone="amber" size="sm">Emergency</Badge>}
                  {g.is_pickup_restricted && <Badge tone="red" size="sm">Pickup restricted</Badge>}
                </div>
                {editable && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${g.full_name}?`)) startTransition(() => deleteGuardian(childId, g.id));
                    }}
                    className="text-gray-300 hover:text-red-500"
                    aria-label="Remove guardian"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                <div className="divide-y divide-gray-50">
                  <PencilField label="Full name" {...bind(`g:${g.id}:full_name`)} />
                  <PencilField label="Relationship" type="select" options={REL_OPTIONS} {...bind(`g:${g.id}:relationship`)} />
                  <PencilField label="Mobile phone" {...bind(`g:${g.id}:mobile_phone`)} />
                  <PencilField label="Email" {...bind(`g:${g.id}:email`)} />
                </div>
                <div className="divide-y divide-gray-50">
                  <PencilField label="Employer" {...bind(`g:${g.id}:employer`)} />
                  <PencilField label="Work phone" {...bind(`g:${g.id}:work_phone`)} />
                  <PencilField label="Primary contact" type="boolean" {...bind(`g:${g.id}:is_primary`)} />
                  <PencilField label="Emergency contact" type="boolean" {...bind(`g:${g.id}:is_emergency`)} />
                  <PencilField label="Pickup restricted" type="boolean" {...bind(`g:${g.id}:is_pickup_restricted`)} />
                </div>
                <div className="md:col-span-2 divide-y divide-gray-50">
                  <PencilField label="Custody / notes" type="textarea" {...bind(`g:${g.id}:custody_note`)} placeholder="—" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Authorized pickups */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Authorized pickups</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="gap-1" disabled={pending} onClick={() => startTransition(() => addPickup(childId))}>
            <Plus className="w-3.5 h-3.5" /> Add pickup
          </Button>
        )}
      </div>
      {family.pickups.length === 0 ? (
        <Card padding="compact" className="mb-4">
          <p className="text-sm text-gray-400">No additional authorized pickups.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {family.pickups.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="grid grid-cols-1 md:grid-cols-3 md:gap-x-6 flex-1">
                  <PencilField label="Full name" {...bind(`p:${p.id}:full_name`)} />
                  <PencilField label="Relationship" {...bind(`p:${p.id}:relationship`)} />
                  <PencilField label="Phone" {...bind(`p:${p.id}:phone`)} />
                </div>
                {editable && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${p.full_name}?`)) startTransition(() => deletePickup(childId, p.id));
                    }}
                    className="text-gray-300 hover:text-red-500 mt-2"
                    aria-label="Remove pickup"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Siblings (display-only) */}
      {family.siblings.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Siblings</h2>
          <Card padding="none" className="divide-y divide-gray-50">
            {family.siblings.map((s) => (
              <Link key={s.id} href={`/students/${s.id}`} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand">
                {s.name}
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
