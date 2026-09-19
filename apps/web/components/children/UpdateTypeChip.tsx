import { UPDATE_TYPE_LABELS, UPDATE_TYPE_CHIP, type UpdateType } from '@kinderbase/types';

export function UpdateTypeChip({ type }: { type: UpdateType }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-chip ${UPDATE_TYPE_CHIP[type]}`}>
      {UPDATE_TYPE_LABELS[type]}
    </span>
  );
}

/** Light blue chip for a tagged child name. */
export function ChildChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-chip bg-sky-50 text-sky-700">
      {name}
    </span>
  );
}
