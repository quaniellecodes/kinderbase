import type { ClassroomStaffingView } from '@kinderbase/types';
import { computeRatio, type RatioResult, type RatioRule } from './staffing-engine';

export type SlotCoverage = {
  day: number;
  slot: number;
  actualStaff: number;
  totalChildren: number;
  ratio: RatioResult;
};

/**
 * Derives per-(day, slot) staffing coverage for a classroom: staff supervising
 * that slot (count of roster rows with a presence cell) vs. children present,
 * with the ratio verdict. Pure — reused by the live grid and the future OCC PDF.
 * Only slots within the center's operating hours [openSlot, closeSlot) are returned.
 */
export function computeSlotCoverage(
  view: ClassroomStaffingView,
  state: string,
  override?: RatioRule
): SlotCoverage[] {
  const out: SlotCoverage[] = [];
  for (const day of view.operatingDays) {
    const childCounts = view.childCountsByDay[day] ?? {};
    for (let slot = view.openSlot; slot < view.closeSlot; slot++) {
      let actualStaff = 0;
      for (const entry of view.roster) {
        if ((entry.slotsByDay[day] ?? []).includes(slot)) actualStaff++;
      }
      const totalChildren = childCounts[slot] ?? 0;
      out.push({
        day,
        slot,
        actualStaff,
        totalChildren,
        ratio: computeRatio(view.ageGroup, totalChildren, actualStaff, state, override),
      });
    }
  }
  return out;
}
