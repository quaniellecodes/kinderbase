import type { RatioStatus } from '@kinderbase/core';
import { Badge, type BadgeTone } from '@/components/ui';

type Props = { status: RatioStatus; label?: string };

const tone: Record<RatioStatus, BadgeTone> = {
  ok: 'green',
  warning: 'amber',
  violation: 'red',
};

const labels: Record<RatioStatus, string> = {
  ok: 'In ratio',
  warning: 'At minimum',
  violation: 'Out of ratio',
};

export function RatioBadge({ status, label }: Props) {
  return (
    <Badge tone={tone[status]} className="text-xs">
      {label ?? labels[status]}
    </Badge>
  );
}
