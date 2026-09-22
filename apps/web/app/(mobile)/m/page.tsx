import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';

export default function MobileIndex() {
  const active = getActiveContextFromCookies();
  redirect(active && isAdmin(active.role) ? '/m/admin' : '/m/today');
}
