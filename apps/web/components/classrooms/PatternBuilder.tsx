'use client';

import { useState, useTransition } from 'react';
import type { AgeGroup, StaffingPatternRow } from '@kinderbase/types';
import { computeRatio, type RatioStatus } from '@kinderbase/core';
import { upsertStaffingPattern } from '@/app/(dashboard)/classrooms/actions';

type Props = {
  classroomId: string;
  ageGroup: AgeGroup;
  typicalEnrollment: number;
  state: string;
  patterns: StaffingPatternRow[];
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6–18

function formatHour(h: number) {
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

const cellStyle: Record<RatioStatus | 'empty', string> = {
  ok:        'bg-green-50 border-green-200 text-green-800',
  warning:   'bg-yellow-50 border-yellow-200 text-yellow-800',
  violation: 'bg-red-50 border-red-200 text-red-800',
  empty:     'bg-gray-50 border-gray-200 text-gray-400',
};

export function PatternBuilder({
  classroomId,
  ageGroup,
  typicalEnrollment,
  state,
  patterns,
}: Props) {
  const [grid, setGrid] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of patterns) {
      map[`${p.day_of_week}-${p.hour}`] = p.staff_count;
    }
    return map;
  });
  const [, startTransition] = useTransition();

  function key(day: number, hour: number) {
    return `${day}-${hour}`;
  }

  function handleChange(day: number, hour: number, raw: string) {
    const count = Math.max(0, parseInt(raw) || 0);
    setGrid(g => ({ ...g, [key(day, hour)]: count }));
    startTransition(() => {
      upsertStaffingPattern(classroomId, day, hour, count);
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full min-w-[340px]">
        <thead>
          <tr>
            <th className="w-14 py-1 pr-2 text-right text-gray-400 font-normal" />
            {DAYS.map((d, i) => (
              <th key={d} className="text-center font-medium text-gray-600 pb-2 px-1 w-[52px]">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(hour => (
            <tr key={hour}>
              <td className="pr-2 text-right text-gray-400 whitespace-nowrap py-0.5">
                {formatHour(hour)}
              </td>
              {DAYS.map((_, dayIdx) => {
                const day = dayIdx + 1;
                const count = grid[key(day, hour)] ?? 0;
                const status = count === 0
                  ? 'empty'
                  : computeRatio(ageGroup, typicalEnrollment, count, state).status;
                return (
                  <td key={day} className="px-0.5 py-0.5">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={count === 0 ? '' : count}
                      placeholder="0"
                      onChange={e => handleChange(day, hour, e.target.value)}
                      className={`w-full text-center rounded border py-1 focus:outline-none focus:ring-1 focus:ring-brand/40 ${cellStyle[status]}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-gray-400">
        Enter staff count per slot. Green = in ratio · Yellow = at minimum · Red = out of ratio
      </p>
    </div>
  );
}
