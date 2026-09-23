'use client';

import { useEffect } from 'react';

/**
 * Reusable phone bottom sheet (docs/sessions/02-CLASSROOM.md §1): drag-handle,
 * backdrop tap to close, slides up. Every mobile sheet uses this.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-[420px] bg-white rounded-t-2xl max-h-[88%] overflow-y-auto animate-[sheetup_.2s_cubic-bezier(.3,1,.4,1)]"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 bg-white pt-2 pb-1 rounded-t-2xl">
          <div className="mx-auto h-1 w-9 rounded-full bg-gray-200" />
          {title && <div className="px-5 pt-3 text-[15px] font-semibold text-gray-900">{title}</div>}
        </div>
        <div className="px-5 pb-2">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes sheetup {
          from {
            transform: translateY(100%);
          }
          to {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
