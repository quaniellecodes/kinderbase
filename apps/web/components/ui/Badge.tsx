import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center font-medium rounded-chip', {
  variants: {
    tone: {
      neutral: 'bg-gray-100 text-gray-600',
      green: 'bg-green-50 text-green-700',
      amber: 'bg-amber-50 text-amber-700',
      red: 'bg-red-50 text-red-700',
      blue: 'bg-blue-50 text-blue-700',
      purple: 'bg-purple-50 text-purple-700',
      indigo: 'bg-indigo-50 text-indigo-700',
      sky: 'bg-sky-50 text-sky-700',
    },
    size: {
      sm: 'text-[10px] px-1.5 py-0.5',
      md: 'text-[11px] px-2 py-0.5',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
