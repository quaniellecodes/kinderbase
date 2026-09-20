import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const alertVariants = cva('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs', {
  variants: {
    tone: {
      amber: 'bg-amber-50 border-amber-200 text-amber-800',
      red: 'bg-red-50 border-red-200 text-red-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900',
    },
  },
  defaultVariants: { tone: 'amber' },
});

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export function Alert({ className, tone, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ tone }), className)} {...props} />;
}
