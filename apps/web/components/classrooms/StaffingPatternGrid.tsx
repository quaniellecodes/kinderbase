'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Plus, X, Copy, Save, RotateCcw } from 'lucide-react';
import { computeRatio, type RatioStatus } from '@kinderbase/core';
import {
  OPERATING_DAY_LABELS,
  OCC_POSITION_LABELS,
  deriveOccPosition,
  slotToLabel,
  type ClassroomStaffingView,
  type OccPositionCode,
} from '@kinderbase/types';
import {
  saveStaffingPattern,
  type CenterMemberOption,
  type SaveStaffingPayload,
} from '@/app/(dashboard)/classrooms/actions';
import { Button, Input, Select } from '@/components/ui';

type Props = {
  view: ClassroomStaffingView;
  canEdit: boolean;
  members: CenterMemberOption[];
};

type RosterEntry = {
  id: string;
  isNew: boolean;
  userId: string | null;
  displayName: string;
  positionCode: OccPositionCode;
  positionOverride: OccPositionCode | null;
};

type Presence = Record<string, Record<number, Set<number>>>;
type ChildCounts = Record<number, Record<number, number>>;
type Snapshot = { roster: RosterEntry[]; presence: Presence; childCounts: ChildCounts };

type Drag = { rosterId: string; startSlot: number; current: number; value: boolean };

const POSITION_CODES: OccPositionCode[] = ['D', 'TI', 'TP', 'TS', 'ATS', 'A'];

const statusColor: Record<RatioStatus, string> = {
  ok: 'bg-green-500',
  warning: 'bg-yellow-400',
  violation: 'bg-red-500',
};

/** Compact whole-hour column header, e.g. slot 12 → "6a", slot 24 → "12p". Blank on half-hours. */
function compactSlot(slot: number): string {
  const minutes = slot * 30;
  if (minutes % 60 !== 0) return '';
  const hour24 = Math.floor(minutes / 60) % 24;
  const period = hour24 < 12 ? 'a' : 'p';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${period}`;
}

function snapshotFromView(view: ClassroomStaffingView): Snapshot {
  const roster: RosterEntry[] = view.roster.map((r) => ({
    id: r.id,
    isNew: false,
    userId: r.userId,
    displayName: r.displayName,
    positionCode: r.positionCode,
    positionOverride: r.positionOverride,
  }));
  const presence: Presence = {};
  for (const r of view.roster) {
    presence[r.id] = {};
    for (const [day, arr] of Object.entries(r.slotsByDay)) {
      presence[r.id]![Number(day)] = new Set(arr);
    }
  }
  const childCounts: ChildCounts = {};
  for (const [day, slots] of Object.entries(view.childCountsByDay)) {
    childCounts[Number(day)] = { ...slots };
  }
  return { roster, presence, childCounts };
}

function cloneSnapshot(s: Snapshot): Snapshot {
  const presence: Presence = {};
  for (const [id, byDay] of Object.entries(s.presence)) {
    presence[id] = {};
    for (const [day, set] of Object.entries(byDay)) presence[id]![Number(day)] = new Set(set);
  }
  const childCounts: ChildCounts = {};
  for (const [day, slots] of Object.entries(s.childCounts)) childCounts[Number(day)] = { ...slots };
  return { roster: s.roster.map((r) => ({ ...r })), presence, childCounts };
}

export function StaffingPatternGrid({ view, canEdit, members }: Props) {
  const operatingDays = [...view.operatingDays].sort((a, b) => a - b);
  const slots: number[] = [];
  for (let s = view.openSlot; s < view.closeSlot; s++) slots.push(s);

  const [selectedDay, setSelectedDay] = useState<number>(operatingDays[0] ?? 1);
  const initial = useMemo(() => snapshotFromView(view), [view]);
  const [roster, setRoster] = useState<RosterEntry[]>(() => initial.roster);
  const [presence, setPresence] = useState<Presence>(() => initial.presence);
  const [childCounts, setChildCounts] = useState<ChildCounts>(() => initial.childCounts);
  const [baseline, setBaseline] = useState<Snapshot>(() => cloneSnapshot(initial));
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [isSaving, startSave] = useTransition();
  const tmpCounter = useRef(0);

  // Add-staff form
  const [newMemberId, setNewMemberId] = useState('');
  const [newName, setNewName] = useState('');

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function presentAt(rosterId: string, slot: number): boolean {
    const base = presence[rosterId]?.[selectedDay]?.has(slot) ?? false;
    if (drag && drag.rosterId === rosterId) {
      const lo = Math.min(drag.startSlot, drag.current);
      const hi = Math.max(drag.startSlot, drag.current);
      if (slot >= lo && slot <= hi) return drag.value;
    }
    return base;
  }

  function staffCountAt(slot: number): number {
    let n = 0;
    for (const r of roster) if (presentAt(r.id, slot)) n++;
    return n;
  }

  // Commit a drag on mouse-up anywhere.
  useEffect(() => {
    if (!drag) return;
    function commit() {
      if (!drag) return;
      const lo = Math.min(drag.startSlot, drag.current);
      const hi = Math.max(drag.startSlot, drag.current);
      setPresence((prev) => {
        const next = { ...prev };
        const byDay = { ...(next[drag.rosterId] ?? {}) };
        const set = new Set(byDay[selectedDay] ?? []);
        for (let s = lo; s <= hi; s++) {
          if (drag.value) set.add(s);
          else set.delete(s);
        }
        byDay[selectedDay] = set;
        next[drag.rosterId] = byDay;
        return next;
      });
      setDirty(true);
      setDrag(null);
    }
    window.addEventListener('mouseup', commit);
    return () => window.removeEventListener('mouseup', commit);
  }, [drag, selectedDay]);

  function handleAddMember() {
    if (!newMemberId) return;
    const member = members.find((m) => m.userId === newMemberId);
    if (!member) return;
    const positionCode = deriveOccPosition(member.role, view.ageGroup);
    const id = `tmp-${tmpCounter.current++}`;
    setRoster((r) => [
      ...r,
      { id, isNew: true, userId: member.userId, displayName: member.fullName, positionCode, positionOverride: null },
    ]);
    setPresence((p) => ({ ...p, [id]: {} }));
    setNewMemberId('');
    setDirty(true);
  }

  function handleAddFreeText() {
    const name = newName.trim();
    if (!name) return;
    const id = `tmp-${tmpCounter.current++}`;
    setRoster((r) => [
      ...r,
      { id, isNew: true, userId: null, displayName: name, positionCode: 'A', positionOverride: 'A' },
    ]);
    setPresence((p) => ({ ...p, [id]: {} }));
    setNewName('');
    setDirty(true);
  }

  function handleRemove(rosterId: string) {
    setRoster((r) => r.filter((x) => x.id !== rosterId));
    setPresence((p) => {
      const next = { ...p };
      delete next[rosterId];
      return next;
    });
    setDirty(true);
  }

  function handlePosition(rosterId: string, code: OccPositionCode) {
    setRoster((r) => r.map((x) => (x.id === rosterId ? { ...x, positionCode: code, positionOverride: code } : x)));
    setDirty(true);
  }

  function handleChildCount(slot: number, raw: string) {
    const total = Math.max(0, Math.min(999, parseInt(raw) || 0));
    setChildCounts((prev) => {
      const next = { ...prev };
      next[selectedDay] = { ...(next[selectedDay] ?? {}), [slot]: total };
      return next;
    });
    setDirty(true);
  }

  function handleCopyToAll() {
    setPresence((prev) => {
      const next: Presence = {};
      for (const r of roster) {
        const srcSet = new Set(prev[r.id]?.[selectedDay] ?? []);
        next[r.id] = {};
        for (const day of operatingDays) next[r.id]![day] = new Set(srcSet);
      }
      return next;
    });
    setDirty(true);
  }

  function handleReset() {
    const restored = cloneSnapshot(baseline);
    setRoster(restored.roster);
    setPresence(restored.presence);
    setChildCounts(restored.childCounts);
    setDirty(false);
    setSaveError(null);
  }

  function handleSave() {
    const payload: SaveStaffingPayload = {
      roster: roster.map((r) => ({
        id: r.id,
        isNew: r.isNew,
        userId: r.userId,
        staffName: r.userId ? null : r.displayName,
        positionCode: r.positionCode,
        slotsByDay: Object.fromEntries(
          Object.entries(presence[r.id] ?? {}).map(([day, set]) => [Number(day), [...set]])
        ),
      })),
      childCountsByDay: childCounts,
    };
    startSave(async () => {
      try {
        const saved = await saveStaffingPattern(view.classroomId, payload);
        const snap = snapshotFromView(saved);
        setRoster(snap.roster);
        setPresence(snap.presence);
        setChildCounts(snap.childCounts);
        setBaseline(cloneSnapshot(snap));
        setDirty(false);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Could not save');
      }
    });
  }

  const availableMembers = members.filter((m) => !roster.some((r) => r.userId === m.userId));
  const childCountFor = (slot: number) => childCounts[selectedDay]?.[slot] ?? 0;

  if (operatingDays.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No operating days set for this center. Set hours &amp; days in{' '}
        <a href="/settings" className="text-brand underline">Settings</a> to build the staffing pattern.
      </p>
    );
  }

  return (
    <div>
      {/* Day tabs + save controls */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        {operatingDays.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              day === selectedDay ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {OPERATING_DAY_LABELS[day]}
          </button>
        ))}
        {canEdit && (
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
            <button
              onClick={handleCopyToAll}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              title="Copy this day's staff shifts to all operating days"
            >
              <Copy className="w-3 h-3" /> Copy to all days
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              disabled={!dirty || isSaving}
              className="gap-1 px-2 rounded text-gray-600 hover:bg-gray-50 hover:border-gray-200 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || isSaving}
              className="gap-1 px-3 rounded disabled:opacity-40"
            >
              <Save className="w-3 h-3" /> {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {saveError && <p className="text-xs text-red-500 mb-2">{saveError}</p>}

      {/* Grid */}
      <div className="overflow-x-auto select-none">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white text-left font-medium text-gray-500 pr-2 pb-1 min-w-[150px]">
                Staff
              </th>
              {slots.map((slot) => (
                <th
                  key={slot}
                  title={slotToLabel(slot)}
                  className="w-[30px] text-[10px] text-gray-400 font-normal pb-1"
                >
                  {compactSlot(slot)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.id} className="group">
                <td className="sticky left-0 z-10 bg-white pr-2 py-0.5">
                  <div className="flex items-center gap-1.5">
                    {canEdit ? (
                      <select
                        value={r.positionCode}
                        onChange={(e) => handlePosition(r.id, e.target.value as OccPositionCode)}
                        title={OCC_POSITION_LABELS[r.positionCode]}
                        className="text-[10px] rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-gray-600"
                      >
                        {POSITION_CODES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        title={OCC_POSITION_LABELS[r.positionCode]}
                        className="text-[10px] rounded bg-gray-100 px-1 py-0.5 text-gray-600"
                      >
                        {r.positionCode}
                      </span>
                    )}
                    <span className="text-gray-800 truncate max-w-[95px]" title={r.displayName}>
                      {r.displayName}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleRemove(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"
                        title="Remove from room"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                {slots.map((slot) => {
                  const on = presentAt(r.id, slot);
                  return (
                    <td key={slot} className="p-0">
                      <div
                        onMouseDown={
                          canEdit
                            ? () => setDrag({ rosterId: r.id, startSlot: slot, current: slot, value: !on })
                            : undefined
                        }
                        onMouseEnter={
                          canEdit && drag && drag.rosterId === r.id
                            ? () => setDrag((d) => (d ? { ...d, current: slot } : d))
                            : undefined
                        }
                        className={`h-7 w-[30px] border-r border-b border-gray-100 ${
                          on ? 'bg-brand' : 'bg-white'
                        } ${canEdit ? 'cursor-pointer' : ''}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            {roster.length === 0 && (
              <tr>
                <td colSpan={slots.length + 1} className="py-3 text-xs text-gray-400">
                  No staff assigned yet.
                </td>
              </tr>
            )}

            {/* Total children */}
            <tr className="border-t border-gray-200">
              <td className="sticky left-0 z-10 bg-white pr-2 py-1 text-gray-500 font-medium">
                Total children
              </td>
              {slots.map((slot) => (
                <td key={slot} className="p-0 align-middle">
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={childCountFor(slot) === 0 ? '' : childCountFor(slot)}
                      placeholder="0"
                      onChange={(e) => handleChildCount(slot, e.target.value)}
                      className="h-7 w-[30px] text-center text-[11px] border-r border-gray-100 focus:outline-none focus:ring-1 focus:ring-brand/40 text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <div className="h-7 w-[30px] text-center text-[11px] leading-7 text-gray-700 border-r border-gray-100">
                      {childCountFor(slot) || ''}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* Ratio strip */}
            <tr>
              <td className="sticky left-0 z-10 bg-white pr-2 py-1 text-gray-500 font-medium">Ratio</td>
              {slots.map((slot) => {
                const children = childCountFor(slot);
                const staff = staffCountAt(slot);
                const { status } = computeRatio(view.ageGroup, children, staff, view.state);
                return (
                  <td key={slot} className="p-0">
                    <div
                      title={`${slotToLabel(slot)} · ${staff} staff / ${children} children`}
                      className={`h-2 w-[30px] ${children === 0 && staff === 0 ? 'bg-gray-100' : statusColor[status]}`}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add staff */}
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select
            value={newMemberId}
            onChange={(e) => setNewMemberId(e.target.value)}
            className="w-auto text-xs rounded px-2 py-1 text-gray-700"
          >
            <option value="">Add member…</option>
            {availableMembers.map((m) => (
              <option key={m.userId} value={m.userId}>{m.fullName}</option>
            ))}
          </Select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddMember}
            disabled={!newMemberId}
            className="gap-1 rounded px-2 disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
          <span className="text-gray-300 text-xs">or</span>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (not a member)"
            className="w-auto text-xs rounded px-2 py-1 text-gray-700"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddFreeText}
            disabled={!newName.trim()}
            className="gap-1 rounded px-2 text-gray-700 hover:border-gray-200 disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Add name
          </Button>
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-400">
        {canEdit ? 'Click and drag along a staff row to set their shift; drag over a filled range to clear it (breaks = gaps). Changes save only when you click Save. ' : ''}
        Ratio bar: green = in ratio · yellow = at minimum · red = out of ratio.
      </p>
    </div>
  );
}
