'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, DoorOpen, MessageSquare, User, Plus, LayoutGrid, Inbox, Users } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { isAdmin, type CenterRole } from '@kinderbase/types';
import { cn } from '@/lib/utils';

const TEACHER_TABS = [
  { href: '/m/today', label: 'Today', icon: Home, match: (p: string) => p === '/m/today' || p === '/m' },
  { href: '/m/classroom', label: 'Classroom', icon: DoorOpen, match: (p: string) => p.startsWith('/m/classroom') },
  { href: '/m/messages', label: 'Messages', icon: MessageSquare, match: (p: string) => p.startsWith('/m/messages') },
  { href: '/m/me', label: 'Me', icon: User, match: (p: string) => p.startsWith('/m/me') },
];
const ADMIN_TABS = [
  { href: '/m/admin', label: 'Home', icon: Home, match: (p: string) => p === '/m/admin' || p === '/m' },
  { href: '/m/admin/rooms', label: 'Rooms', icon: LayoutGrid, match: (p: string) => p.startsWith('/m/admin/rooms') || p.startsWith('/m/classroom') },
  { href: '/m/admin/inbox', label: 'Inbox', icon: Inbox, match: (p: string) => p.startsWith('/m/admin/inbox') },
  { href: '/m/admin/people', label: 'People', icon: Users, match: (p: string) => p.startsWith('/m/admin/people') },
];

const QUICK = [
  ['📸', 'Photo post'],
  ['🎙️', 'Voice note'],
  ['🍼', 'Log update'],
  ['⭐', 'Milestone'],
  ['🗓️', 'Time off'],
  ['⚠️', 'Incident'],
] as const;

export function MobileNav({ role }: { role: CenterRole }) {
  const pathname = usePathname();
  const [add, setAdd] = useState(false);
  const TABS = isAdmin(role) ? ADMIN_TABS : TEACHER_TABS;

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 flex items-end px-1"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        {TABS.slice(0, 2).map((t) => (
          <NavItem key={t.href} {...t} active={t.match(pathname)} />
        ))}
        <div className="flex-shrink-0 px-2">
          <button
            onClick={() => setAdd(true)}
            aria-label="Quick add"
            className="w-[54px] h-[54px] -mt-4 rounded-full bg-brand text-white flex items-center justify-center shadow-lg shadow-brand/40"
          >
            <Plus className="w-6 h-6" strokeWidth={2.4} />
          </button>
        </div>
        {TABS.slice(2).map((t) => (
          <NavItem key={t.href} {...t} active={t.match(pathname)} />
        ))}
      </nav>

      <BottomSheet open={add} onClose={() => setAdd(false)} title="Quick add">
        <p className="text-xs text-gray-400 mb-3">Posts to your active classroom.</p>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {QUICK.map(([e, l]) => (
            <button
              key={l}
              onClick={() => setAdd(false)}
              className="rounded-xl border border-gray-100 bg-gray-50 py-4 flex flex-col items-center gap-1.5"
            >
              <span className="text-xl">{e}</span>
              <span className="text-[11px] font-medium text-gray-700">{l}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[54px]">
      <Icon className={cn('w-5 h-5', active ? 'text-brand' : 'text-gray-400')} strokeWidth={active ? 2.2 : 1.7} />
      <span className={cn('text-[10px]', active ? 'text-brand font-semibold' : 'text-gray-400')}>{label}</span>
    </Link>
  );
}
