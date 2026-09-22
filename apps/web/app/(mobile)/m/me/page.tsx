import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { Card, Avatar, buttonVariants } from '@/components/ui';

export default async function MePage() {
  const active = getActiveContextFromCookies();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.full_name as string | undefined) ?? 'You';

  return (
    <div className="p-4">
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500 capitalize">
              {active?.role?.replace('_', ' ')} · {active?.centerName}
            </p>
          </div>
        </div>
        {user && (
          <Link href={`/staff/${user.id}`} className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} w-full mt-3`}>
            Open full profile
          </Link>
        )}
      </Card>
      <p className="text-xs text-gray-400">
        Growth, schedule, credentials, and coaching land in a later step (Session 3).
      </p>
    </div>
  );
}
