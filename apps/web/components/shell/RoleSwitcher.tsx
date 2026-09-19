'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { switchActiveContext } from '@/app/(dashboard)/actions';
import { setNativeActiveContext } from '@/lib/mobile/capacitor';
import type { ActiveContext, CenterRole } from '@kinderbase/types';

type Membership = {
  centerId: string;
  centerName: string;
  role: CenterRole;
};

type Props = {
  variant: 'dropdown' | 'bottom-sheet';
  memberships: Membership[];
  active: ActiveContext;
};

function roleLabel(role: CenterRole): string {
  return {
    director: 'Director',
    admin: 'Admin',
    lead_teacher: 'Lead Teacher',
    assistant_teacher: 'Assistant Teacher',
    aide: 'Aide',
    substitute: 'Substitute',
  }[role];
}

function groupByCenterId(memberships: Membership[]): Map<string, Membership[]> {
  const map = new Map<string, Membership[]>();
  for (const m of memberships) {
    const existing = map.get(m.centerId) ?? [];
    existing.push(m);
    map.set(m.centerId, existing);
  }
  return map;
}

export function RoleSwitcher({ variant, memberships, active }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const grouped = groupByCenterId(memberships);

  function select(membership: Membership) {
    const ctx: ActiveContext = {
      centerId: membership.centerId,
      centerName: membership.centerName,
      role: membership.role,
    };
    setOpen(false);
    startTransition(async () => {
      await setNativeActiveContext(ctx);
      await switchActiveContext(ctx);
      router.refresh();
    });
  }

  const trigger = (
    <button
      onClick={() => setOpen((v) => !v)}
      className={cn(
        'flex items-center gap-2 min-h-[44px] w-full text-left',
        variant === 'dropdown'
          ? 'rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50'
          : 'px-4 py-3',
      )}
      aria-expanded={open}
    >
      <Building2 size={15} className="shrink-0 text-gray-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{active.centerName}</p>
        <p className="text-xs text-gray-500">{roleLabel(active.role)}</p>
      </div>
      <ChevronDown
        size={14}
        className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
      />
    </button>
  );

  const menu = (
    <div className="divide-y divide-gray-100">
      {Array.from(grouped.entries()).map(([centerId, centerMemberships]) => (
        <div key={centerId} className="py-2">
          <p className="px-4 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
            {centerMemberships[0]!.centerName}
          </p>
          {centerMemberships.map((m) => {
            const isActive = m.centerId === active.centerId && m.role === active.role;
            return (
              <button
                key={`${m.centerId}-${m.role}`}
                onClick={() => select(m)}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm min-h-[44px]',
                  'hover:bg-gray-50 disabled:opacity-50',
                  isActive && 'text-brand font-medium',
                  !isActive && 'text-gray-700',
                )}
              >
                <Check
                  size={14}
                  className={cn('shrink-0', isActive ? 'text-brand' : 'text-transparent')}
                />
                {roleLabel(m.role)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        {trigger}
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
              {menu}
            </div>
          </>
        )}
      </div>
    );
  }

  // bottom-sheet variant
  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-[14px] pb-safe max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">Switch center or role</p>
              <button
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            {menu}
          </div>
        </div>
      )}
    </>
  );
}
