import { cn } from '@/lib/utils';

const TONES = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red: 'bg-status-red',
  gray: 'bg-gray-300',
};

export function StatusDot({ tone = 'gray', className }: { tone?: keyof typeof TONES; className?: string }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', TONES[tone], className)} />;
}
