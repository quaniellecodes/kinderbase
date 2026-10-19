'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sprout, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// Four tabs (PARENT-DECISIONS kb-parent.html): Home · Progress · Messages · the
// child's own name. (The first tab shows previous days too, so it reads "Home"
// rather than "Today"; its route stays /p/today.)
export function ParentNav({ firstName }: { firstName: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/p/today', label: 'Home', icon: Home },
    { href: '/p/progress', label: 'Progress', icon: Sprout },
    { href: '/p/messages', label: 'Messages', icon: MessageSquare },
    { href: '/p/child', label: firstName, icon: User },
  ];
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 flex"
      style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[54px]">
            <Icon className={cn('w-5 h-5', active ? 'text-brand' : 'text-gray-400')} strokeWidth={active ? 2.2 : 1.7} />
            <span className={cn('text-[10px] max-w-[72px] truncate', active ? 'text-brand font-semibold' : 'text-gray-400')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
