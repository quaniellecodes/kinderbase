'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/(dashboard)/actions';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.push('/login');
        })
      }
      disabled={isPending}
      className="flex items-center gap-2 w-full px-2 py-2 text-xs text-gray-400 hover:text-gray-600 rounded-[8px] hover:bg-gray-50 min-h-[44px] disabled:opacity-50"
    >
      <LogOut size={14} />
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
