import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getStudentDirectory } from './actions';
import { StudentsClient } from './StudentsClient';

export default async function StudentsPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');

  const { students, classrooms, tags } = await getStudentDirectory(active.centerId);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <StudentsClient students={students} classrooms={classrooms} tags={tags} canAdd={isAdmin(active.role)} />
    </div>
  );
}
