import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { ReportsClient } from './ReportsClient';

export default function ReportsPage() {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) redirect('/dashboard');

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-medium text-gray-900 mb-6">Reports</h1>
      <ReportsClient />
    </div>
  );
}
