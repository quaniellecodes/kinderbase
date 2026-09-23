import { redirect } from 'next/navigation';
import { getToday } from './actions';
import { TodayClient } from './TodayClient';

export default async function TodayPage() {
  const data = await getToday();
  if (!data) redirect('/dashboard');
  return <TodayClient data={data} />;
}
