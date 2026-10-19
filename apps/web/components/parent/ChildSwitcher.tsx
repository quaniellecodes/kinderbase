'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { switchChild } from '@/app/(parent)/p/actions';
import type { ParentChildOption } from '@/lib/parent/shell';

// Header child switcher for guardians with more than one child. Sets the active
// child (cookie, server-side) and refreshes so every tab re-resolves to it.
export function ChildSwitcher({ options, activeId, activeLabel }: { options: ParentChildOption[]; activeId: string; activeLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(id: string) {
    setOpen(false);
    if (id === activeId) return;
    start(async () => {
      try {
        await switchChild(id);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not switch');
      }
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="flex items-center gap-1 text-[11px] text-gray-500 max-w-[150px]"
        aria-label="Switch child"
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50"
            >
              <Check className={cn('w-3.5 h-3.5 flex-shrink-0', c.id === activeId ? 'text-brand' : 'text-transparent')} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
