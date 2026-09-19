'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cake } from 'lucide-react';
import { formatAgeMonths } from '@kinderbase/types';
import { Avatar } from '@/components/ui/Avatar';
import { clockTime } from '@/lib/format';
import { signInChild, signOutChild, type ChildCard } from '@/app/(dashboard)/classrooms/child-actions';

export function ChildrenTab({ children }: { children: ChildCard[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  function toggle(child: ChildCard) {
    start(async () => {
      if (child.present) await signOutChild(child.id);
      else await signInChild(child.id);
      router.refresh();
    });
  }

  if (children.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">No children enrolled in this room yet.</p>;
  }

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-wide text-gray-400 mb-3">Enrolled children</h2>
      <div className="space-y-2">
        {children.map((child) => (
          <div
            key={child.id}
            className={`flex items-center gap-3 rounded-card border px-4 py-3 ${
              child.boundary ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <Avatar name={child.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                {child.name}
                {child.boundary && <Cake className="w-3.5 h-3.5 text-amber-600" />}
              </p>
              <p className="text-xs text-gray-500">
                {formatAgeMonths(child.ageMonths)}
                {child.present && child.signedInAt
                  ? ` · signed in ${clockTime(child.signedInAt)}`
                  : ' · absent today'}
                {child.boundary && ` · turns age group in ${child.boundary.days}d`}
              </p>
            </div>
            {child.updatesToday > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-chip bg-green-50 text-green-700 font-medium">
                {child.updatesToday} update{child.updatesToday === 1 ? '' : 's'} today
              </span>
            )}
            <button
              onClick={() => toggle(child)}
              disabled={isPending}
              className={`text-xs px-2.5 py-1 rounded-chip font-medium disabled:opacity-50 ${
                child.present ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-brand text-white'
              }`}
            >
              {child.present ? 'Sign out' : 'Sign in'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
