'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  FileCheck,
  Calendar,
  Clock,
  ClipboardList,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoleSwitcher } from './RoleSwitcher';
import { isAdmin } from '@kinderbase/types';
import type { ActiveContext, CenterRole } from '@kinderbase/types';

type Membership = {
  centerId: string;
  centerName: string;
  role: CenterRole;
};

type Props = {
  memberships: Membership[];
  active: ActiveContext;
};

const adminTabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/classrooms', label: 'Rooms', icon: DoorOpen },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
];

const teacherTabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/credentials', label: 'Credentials', icon: FileCheck },
  { href: '/time', label: 'Time', icon: Clock },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
];

export function BottomNav({ memberships, active }: Props) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const tabs = isAdmin(active.role) ? adminTabs : teacherTabs;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 flex items-stretch">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px]',
                isActive ? 'text-brand' : 'text-gray-400',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}

        {/* Avatar tab — opens RoleSwitcher bottom-sheet */}
        <button
          onClick={() => setSwitcherOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] text-gray-400"
        >
          <UserCircle size={20} strokeWidth={1.5} />
          Account
        </button>
      </nav>

      {/* Bottom-sheet RoleSwitcher rendered outside nav to allow full-screen overlay */}
      {switcherOpen && (
        <div className="md:hidden">
          <RoleSwitcherSheet
            memberships={memberships}
            active={active}
            onClose={() => setSwitcherOpen(false)}
          />
        </div>
      )}

      {/* Spacer so content isn't hidden behind the fixed nav */}
      <div className="md:hidden h-[56px]" />
    </>
  );
}

function RoleSwitcherSheet({
  memberships,
  active,
  onClose,
}: {
  memberships: Membership[];
  active: ActiveContext;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-[14px] max-h-[70vh] overflow-y-auto">
        <RoleSwitcher variant="bottom-sheet" memberships={memberships} active={active} />
      </div>
    </div>
  );
}
