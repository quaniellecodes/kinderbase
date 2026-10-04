import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { isAdmin } from '@kinderbase/types';
import { isoDate } from '@kinderbase/core';
import { CalendarClient } from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');
  const active = getActiveContextFromCookies();
  if (!active) redirect('/login');

  const now = getClock().now();
  const todayIso = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="max-w-[1300px] mx-auto mb-5">
        <h1 className="text-xl font-medium text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">Trips, closures, conferences, birthdays, and time off</p>
      </div>
      <div className="max-w-[1300px] mx-auto">
        <CalendarClient admin={isAdmin(active.role)} todayIso={todayIso} variant="desktop" />
      </div>
    </div>
  );
}
