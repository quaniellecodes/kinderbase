'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { OPERATING_DAY_LABELS, slotToLabel, type ClassroomStaffingView } from '@kinderbase/types';
import { Button, Card } from '@/components/ui';
import { HoursFields } from '@/components/classrooms/HoursFields';
import {
  updateClassroomHours,
  type ClassroomHoursInfo,
} from '@/app/(dashboard)/classrooms/actions';

type Props = {
  classroomId: string;
  hours: ClassroomHoursInfo;
  view: ClassroomStaffingView;
};

function summarize(open: number, close: number, days: number[]): string {
  const dayLabels = [...days].sort((a, b) => a - b).map((d) => OPERATING_DAY_LABELS[d]).join(', ');
  return `${slotToLabel(open)}–${slotToLabel(close)} · ${dayLabels || 'no days'}`;
}

/** Counts shift cells + child-count entries in the current view that fall outside a window. */
function countOrphans(view: ClassroomStaffingView, open: number, close: number, days: number[]) {
  const daySet = new Set(days);
  let cells = 0;
  const droppedDays = new Set<number>();
  for (const r of view.roster) {
    for (const [d, slots] of Object.entries(r.slotsByDay)) {
      const day = Number(d);
      for (const s of slots) {
        if (!daySet.has(day) || s < open || s >= close) {
          cells++;
          if (!daySet.has(day)) droppedDays.add(day);
        }
      }
    }
  }
  for (const [d, slots] of Object.entries(view.childCountsByDay)) {
    const day = Number(d);
    for (const s of Object.keys(slots)) {
      const slot = Number(s);
      if (!daySet.has(day) || slot < open || slot >= close) cells++;
    }
  }
  return { cells, droppedDays: droppedDays.size };
}

export function ClassroomHoursEditor({ classroomId, hours, view }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(hours.overridden);
  const [openSlot, setOpenSlot] = useState(hours.effective.openSlot);
  const [closeSlot, setCloseSlot] = useState(hours.effective.closeSlot);
  const [days, setDays] = useState<number[]>(hours.effective.operatingDays);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  function toggleDay(day: number) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day].sort((a, b) => a - b)));
  }

  function handleSave() {
    setError(null);
    const override = custom ? { openSlot, closeSlot, operatingDays: days } : null;
    if (custom) {
      if (openSlot >= closeSlot) return setError('Close time must be after open time');
      if (days.length === 0) return setError('Select at least one operating day');
    }
    // Effective window we're moving to (custom values, or the center default).
    const eff = custom
      ? { open: openSlot, close: closeSlot, days }
      : { open: hours.center.openSlot, close: hours.center.closeSlot, days: hours.center.operatingDays };
    const { cells, droppedDays } = countOrphans(view, eff.open, eff.close, eff.days);
    if (cells > 0) {
      const dayNote = droppedDays > 0 ? ` (including ${droppedDays} full day${droppedDays > 1 ? 's' : ''})` : '';
      const ok = window.confirm(
        `${cells} shift/child-count cell${cells > 1 ? 's' : ''}${dayNote} fall outside the new hours and will be removed. ` +
          `Any unsaved staffing edits will also be discarded. Continue?`
      );
      if (!ok) return;
    }
    startSave(async () => {
      try {
        await updateClassroomHours(classroomId, override);
        router.refresh();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save hours');
      }
    });
  }

  const current = summarize(hours.effective.openSlot, hours.effective.closeSlot, hours.effective.operatingDays);

  return (
    <Card padding="compact" className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">Hours &amp; days</span>
        <span className="ml-auto text-xs text-gray-400">
          {current}{!hours.overridden && ' · center default'}
        </span>
      </button>

      {open && (
        <div className="mt-4 pl-6">
          <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
            <input
              type="checkbox"
              checked={!custom}
              onChange={(e) => {
                const inherit = e.target.checked;
                setCustom(!inherit);
                if (!inherit) {
                  // switching to custom: pre-fill from center default
                  setOpenSlot(hours.center.openSlot);
                  setCloseSlot(hours.center.closeSlot);
                  setDays(hours.center.operatingDays);
                }
              }}
            />
            Use center default ({summarize(hours.center.openSlot, hours.center.closeSlot, hours.center.operatingDays)})
          </label>

          {custom && (
            <div className="mb-3">
              <HoursFields
                openSlot={openSlot}
                closeSlot={closeSlot}
                days={days}
                onOpenSlot={setOpenSlot}
                onCloseSlot={setCloseSlot}
                onToggleDay={toggleDay}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? 'Saving…' : 'Save hours'}
          </Button>
        </div>
      )}
    </Card>
  );
}
