import { UPDATE_TYPE_LABELS, type UpdateType } from '@kinderbase/types';
import { Badge, type BadgeTone } from '@/components/ui';

const TONE: Record<UpdateType, BadgeTone> = {
  meal: 'green',
  nap: 'indigo',
  milestone: 'amber',
  incident: 'red',
};

export function UpdateTypeChip({ type }: { type: UpdateType }) {
  return <Badge tone={TONE[type]}>{UPDATE_TYPE_LABELS[type]}</Badge>;
}

/** Light-blue chip for a tagged child name. */
export function ChildChip({ name }: { name: string }) {
  return <Badge tone="sky">{name}</Badge>;
}
