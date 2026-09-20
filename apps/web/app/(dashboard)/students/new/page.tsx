import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getNewStudentOptions } from './new-actions';
import { WizardClient } from './WizardClient';

export default async function NewStudentPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');
  if (!isAdmin(active.role)) redirect('/students');

  const options = await getNewStudentOptions();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> All students
      </Link>
      <h1 className="text-lg font-medium text-gray-900 mb-4">Add student</h1>
      <WizardClient options={options} />
    </div>
  );
}
