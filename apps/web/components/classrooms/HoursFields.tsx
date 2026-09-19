'use client';

import { OPERATING_DAY_LABELS, slotToLabel, SLOTS_PER_DAY } from '@kinderbase/types';

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7];
const OPEN_SLOT_OPTIONS = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i); // 0..47
const CLOSE_SLOT_OPTIONS = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i + 1); // 1..48

type Props = {
  openSlot: number;
  closeSlot: number;
  days: number[];
  onOpenSlot: (n: number) => void;
  onCloseSlot: (n: number) => void;
  onToggleDay: (day: number) => void;
  disabled?: boolean;
};

/** Controlled open/close-time selects + Mon–Sun toggles. Shared by Settings and per-classroom editors. */
export function HoursFields({ openSlot, closeSlot, days, onOpenSlot, onCloseSlot, onToggleDay, disabled }: Props) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-gray-500">
          Opens
          <select
            value={openSlot}
            disabled={disabled}
            onChange={(e) => onOpenSlot(Number(e.target.value))}
            className="ml-2 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
          >
            {OPEN_SLOT_OPTIONS.map((s) => (
              <option key={s} value={s}>{slotToLabel(s)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Closes
          <select
            value={closeSlot}
            disabled={disabled}
            onChange={(e) => onCloseSlot(Number(e.target.value))}
            className="ml-2 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
          >
            {CLOSE_SLOT_OPTIONS.map((s) => (
              <option key={s} value={s}>{slotToLabel(s)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAY_NUMBERS.map((day) => (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => onToggleDay(day)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              days.includes(day) ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {OPERATING_DAY_LABELS[day]}
          </button>
        ))}
      </div>
    </div>
  );
}
