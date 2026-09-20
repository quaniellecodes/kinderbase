import { cn } from '@/lib/utils';

const TONES = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red: 'bg-status-red',
  brand: 'bg-brand',
};

/** Thin progress bar. `value` is 0–100. */
export function ProgressBar({ value, tone = 'green', className }: { value: number; tone?: keyof typeof TONES; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 rounded-full bg-gray-100 overflow-hidden', className)}>
      <div className={cn('h-full rounded-full', TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
