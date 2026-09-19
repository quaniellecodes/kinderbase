'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Props = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function NavLink({ href, label, icon }: Props) {
  const pathname = usePathname();
  const isActive =
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm min-h-[44px] transition-colors',
        isActive
          ? 'text-brand font-medium bg-brand/5 border-l-2 border-brand -ml-px pl-[11px]'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
      )}
    >
      <span className={cn(isActive ? 'text-brand' : 'text-gray-400')}>{icon}</span>
      {label}
    </Link>
  );
}
