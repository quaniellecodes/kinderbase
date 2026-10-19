'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

// A full slide-up page for the Progress drill-ins (domain + goal). Renders inside the
// parent shell; a close button returns to the Areas list.
export function ProgressDetailShell({ icon, title, subtitle, colour, children }: { icon: string; title: string; subtitle: string; colour: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="p-4" style={{ animation: 'kbSlideUp .22s ease-out' }}>
      <style>{'@keyframes kbSlideUp{from{transform:translateY(18px);opacity:.5}to{transform:translateY(0);opacity:1}}'}</style>
      <div className="flex items-start gap-3 pb-3 border-b border-gray-100 mb-4">
        <span className="text-2xl flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
          <p className="text-[13px] font-semibold mt-0.5" style={{ color: colour }}>{subtitle}</p>
        </div>
        <button onClick={() => router.back()} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
