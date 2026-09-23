import { redirect } from 'next/navigation';
import { getMe } from './actions';
import { MeClient } from './MeClient';

export default async function MePage() {
  const data = await getMe();
  if (!data) redirect('/dashboard');
  return <MeClient data={data} />;
}
