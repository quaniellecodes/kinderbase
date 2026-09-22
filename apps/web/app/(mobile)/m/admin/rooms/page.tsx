import { redirect } from 'next/navigation';
import { getAdminHome } from '../actions';
import { RoomsClient } from './RoomsClient';

export default async function AdminRoomsPage() {
  const data = await getAdminHome();
  if (!data) redirect('/m/today');
  return <RoomsClient rooms={data.rooms} />;
}
