'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  size?: keyof typeof SIZES;
  /** Hide the default close (X) button in the header. */
  hideClose?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * App dialog built on Radix — provides Escape, focus-trap, focus-return, ARIA,
 * and backdrop-close. Matches the app's overlay + card styling.
 */
export function Modal({ open, onOpenChange, title, size = 'sm', hideClose, children, className }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'bg-white rounded-card p-4 shadow-lg max-h-[85vh] overflow-y-auto focus:outline-none',
            SIZES[size],
            className
          )}
        >
          {(title || !hideClose) && (
            <div className="flex items-start justify-between mb-3">
              {title ? (
                <Dialog.Title className="text-sm font-medium text-gray-900">{title}</Dialog.Title>
              ) : (
                <Dialog.Title className="sr-only">Dialog</Dialog.Title>
              )}
              {!hideClose && (
                <Dialog.Close className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              )}
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
