'use client';

import { OPERATING_DAY_LABELS } from '@kinderbase/types';
import { cn } from '@/lib/utils';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Tappable Mon–Sun day toggles. `value` is the set of selected day numbers (1=Mon..7=Sun). */
export function DayToggleRow({
  value,
  onToggle,
  disabled,
  className,
}: {
  value: number[];
  onToggle: (day: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {DAYS.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(day)}
            className={cn(
              'px-2.5 py-1 rounded-chip text-xs font-medium transition-colors disabled:opacity-50',
              on ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {OPERATING_DAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
