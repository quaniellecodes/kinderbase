import type { RatioStatus } from '@kinderbase/core';

type Props = { status: RatioStatus; label?: string };

const styles: Record<RatioStatus, string> = {
  ok:        'bg-green-50 text-green-700',
  warning:   'bg-yellow-50 text-yellow-700',
  violation: 'bg-red-50 text-red-700',
};

const labels: Record<RatioStatus, string> = {
  ok:        'In ratio',
  warning:   'At minimum',
  violation: 'Out of ratio',
};

export function RatioBadge({ status, label }: Props) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-chip ${styles[status]}`}>
      {label ?? labels[status]}
    </span>
  );
}
