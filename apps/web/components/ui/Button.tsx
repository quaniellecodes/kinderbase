import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none focus:outline-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white rounded-lg hover:bg-brand/90',
        secondary: 'border border-gray-200 text-gray-700 rounded-lg hover:border-gray-300',
        danger: 'border border-red-200 text-red-600 rounded-lg hover:bg-red-50',
        ghost: 'text-gray-600 rounded-lg hover:bg-gray-50',
        chip: 'rounded-chip font-medium',
      },
      size: {
        sm: 'text-xs px-2.5 py-1',
        md: 'text-sm px-3 py-1.5',
        lg: 'text-sm px-4 py-2',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';
