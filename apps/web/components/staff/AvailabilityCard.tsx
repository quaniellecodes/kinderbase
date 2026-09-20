'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAvailability } from '@/app/(dashboard)/staff/[userId]/actions';
import type { StaffHeader } from '@/app/(dashboard)/staff/[userId]/actions';
import type { AvailabilityStatus } from '@kinderbase/types';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'M' }, { key: 'tue', label: 'T' }, { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' }, { key: 'fri', label: 'F' }, { key: 'sat', label: 'S' }, { key: 'sun', label: 'S' },
];
const CYCLE: AvailabilityStatus[] = ['full', 'am', 'pm', 'none'];

function circleClass(s: AvailabilityStatus): string {
  if (s === 'full') return 'bg-green-100 text-green-700 border border-green-300';
  if (s === 'am' || s === 'pm') return 'bg-amber-100 text-amber-700 border border-amber-300';
  return 'border border-gray-200 text-gray-300';
}
function circleText(s: AvailabilityStatus): string {
  if (s === 'full') return '✓';
  if (s === 'am') return 'AM';
  if (s === 'pm') return 'PM';
  return '–';
}

export function AvailabilityCard({ header, canEdit }: { header: StaffHeader; canEdit: boolean }) {
  const router = useRouter();
  const p = header.profile;
  const initial: Record<string, AvailabilityStatus> = {};
  for (const d of DAYS) initial[d.key] = (p?.availability?.[d.key] as AvailabilityStatus) ?? 'none';

  const [editing, setEditing] = useState(false);
  const [avail, setAvail] = useState<Record<string, AvailabilityStatus>>(initial);
  const [sick, setSick] = useState(p?.sick_hours ?? 0);
  const [vacation, setVacation] = useState(p?.vacation_hours ?? 0);
  const [personal, setPersonal] = useState(p?.personal_hours ?? 0);
  const [isSaving, startSave] = useTransition();

  function cycle(key: string) {
    setAvail((a) => ({ ...a, [key]: CYCLE[(CYCLE.indexOf(a[key]!) + 1) % CYCLE.length]! }));
  }
  function save() {
    startSave(async () => {
      await updateAvailability(header.userId, { availability: avail, sick_hours: sick, vacation_hours: vacation, personal_hours: personal });
      setEditing(false);
      router.refresh();
    });
  }

  const display = editing ? avail : initial;

  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Availability</h2>
        {canEdit && !editing && <button onClick={() => setEditing(true)} className="text-xs text-brand hover:underline">Edit</button>}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {DAYS.map((d) => (
          <div key={d.key} className="text-center">
            <p className="text-[10px] text-gray-400 mb-1">{d.label}</p>
            <button
              disabled={!editing}
              onClick={() => cycle(d.key)}
              className={`w-full aspect-square rounded-full text-[10px] font-medium flex items-center justify-center ${circleClass(display[d.key]!)} ${editing ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {circleText(display[d.key]!)}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-4">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Available</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Partial</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-gray-300" /> Unavailable</span>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Leave balances</p>
        <LeaveRow label="Sick leave" hours={editing ? sick : (p?.sick_hours ?? 0)} editing={editing} onChange={setSick} />
        <LeaveRow label="Vacation" hours={editing ? vacation : (p?.vacation_hours ?? 0)} editing={editing} onChange={setVacation} />
        <LeaveRow label="Personal" hours={editing ? personal : (p?.personal_hours ?? 0)} editing={editing} onChange={setPersonal} />
      </div>

      {editing && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => { setEditing(false); setAvail(initial); }} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
          <button onClick={save} disabled={isSaving} className="flex-1 text-sm bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-60">
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function LeaveRow({ label, hours, editing, onChange }: { label: string; hours: number; editing: boolean; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      {editing ? (
        <input
          type="number"
          min={0}
          value={hours}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
      ) : (
        <span className="text-sm font-medium text-gray-900">{hours} hrs</span>
      )}
    </div>
  );
}
