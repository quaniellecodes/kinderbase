import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isAdmin } from '@kinderbase/types';
import { isoDate } from '@kinderbase/core';
import { CalendarClient } from '@/app/(dashboard)/calendar/CalendarClient';

export const dynamic = 'force-dynamic';

export default async function MobileCalendarPage() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const now = getClock().now();
  const todayIso = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div>
      <header className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 bg-white">
        <Link href={isAdmin(active.role) ? '/m/admin' : '/m/today'} className="p-1 -ml-1 text-gray-500" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-semibold text-gray-900">Calendar</h1>
      </header>
      <div className="p-4">
        <CalendarClient admin={isAdmin(active.role)} todayIso={todayIso} variant="mobile" />
      </div>
    </div>
  );
}
