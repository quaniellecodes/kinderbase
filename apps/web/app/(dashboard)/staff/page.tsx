import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getStaff } from './actions';
import { StaffClient } from './StaffClient';

export default async function StaffPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');
  if (!isAdmin(active.role)) redirect('/dashboard');

  const staff = await getStaff(active.centerId);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-medium text-gray-900 mb-6">Staff</h1>
      <StaffClient
        centerId={active.centerId}
        staff={staff}
        isDirector={active.role === 'director'}
      />
    </div>
  );
}
