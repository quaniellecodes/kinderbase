import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// "My schedule" — reuses the schedule tab on the user's own staff profile.
export default async function SchedulePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  redirect(`/staff/${user.id}?tab=schedule`);
}
