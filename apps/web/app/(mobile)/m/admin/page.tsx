import { redirect } from 'next/navigation';
import { getAdminHome } from './actions';
import { AdminHomeClient } from './AdminHomeClient';

export default async function AdminHomePage() {
  const data = await getAdminHome();
  if (!data) redirect('/m/today');
  return <AdminHomeClient data={data} />;
}
