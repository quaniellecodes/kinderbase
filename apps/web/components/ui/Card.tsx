import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const cardVariants = cva('bg-white rounded-card border border-gray-100', {
  variants: {
    padding: {
      none: '',
      compact: 'px-4 py-3',
      default: 'px-4 py-4',
      spacious: 'p-6',
    },
  },
  defaultVariants: { padding: 'default' },
});

export type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ padding }), className)} {...props} />
  )
);
Card.displayName = 'Card';
