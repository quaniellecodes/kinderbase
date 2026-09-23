import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getPeople } from '../actions';
import { PeopleClient } from './PeopleClient';

export default async function AdminPeoplePage() {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) redirect('/m/today');
  const { staff, students } = await getPeople();
  return <PeopleClient staff={staff} students={students} />;
}
