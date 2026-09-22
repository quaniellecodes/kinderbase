import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { Card, buttonVariants } from '@/components/ui';
import { DoorOpen } from 'lucide-react';

export default async function TodayPage() {
  const active = getActiveContextFromCookies();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there';
  const h = getClock().now().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-gray-500 mb-4">{active?.centerName}</p>

      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
            <DoorOpen className="w-4 h-4 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Your classroom</p>
            <p className="text-xs text-gray-500">Live ratio, roster, and quick logging</p>
          </div>
          <Link href="/m/classroom" className={buttonVariants({ size: 'sm' })}>
            Open
          </Link>
        </div>
      </Card>

      <p className="text-xs text-gray-400">
        Priorities, your shift, and management updates arrive in a later build step (Session 3).
      </p>
    </div>
  );
}
