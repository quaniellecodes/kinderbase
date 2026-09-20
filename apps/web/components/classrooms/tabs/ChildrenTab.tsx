'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cake } from 'lucide-react';
import { formatAgeMonths } from '@kinderbase/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, Button, Card } from '@/components/ui';
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
          <Card
            key={child.id}
            padding="compact"
            className={`flex items-center gap-3 ${
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
              <Badge tone="green">
                {child.updatesToday} update{child.updatesToday === 1 ? '' : 's'} today
              </Badge>
            )}
            <Button
              onClick={() => toggle(child)}
              disabled={isPending}
              size="sm"
              variant={child.present ? 'secondary' : 'primary'}
              className="rounded-chip"
            >
              {child.present ? 'Sign out' : 'Sign in'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
