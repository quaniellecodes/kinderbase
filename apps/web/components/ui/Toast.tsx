'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; tone: Tone };

// Module-level store so any component can call toast() without context wiring;
// mount <Toaster /> once (in the dashboard layout).
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

export function toast(message: string, tone: Tone = 'success') {
  const item = { id: nextId++, message, tone };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, 2600);
}

const TONE_STYLE: Record<Tone, string> = {
  success: 'text-status-green',
  error: 'text-status-red',
  info: 'text-gray-500',
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (list.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
      {list.map((t) => (
        <div key={t.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-800">
          {t.tone === 'error' ? (
            <AlertCircle className={cn('w-4 h-4', TONE_STYLE.error)} />
          ) : (
            <CheckCircle2 className={cn('w-4 h-4', TONE_STYLE[t.tone])} />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
