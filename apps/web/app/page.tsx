import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Landing router. Staff (any center membership) go to the staff app; a
// guardian-only account goes to the parent app; anyone else falls through to the
// staff holding page. A teacher-parent lands on staff by default and reaches their
// family via the context switcher (Phase 4) — the parent app never carries staff.
export default async function RootPage() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect('/login');

  const service = createServiceClient();
  const { data: staff } = await service.from('center_memberships').select('id').eq('user_id', user.id).is('left_at', null).limit(1);
  if (staff && staff.length) redirect('/dashboard');

  const { data: guardian } = await service.from('guardians').select('id').eq('app_user_id', user.id).limit(1);
  if (guardian && guardian.length) redirect('/p');

  redirect('/dashboard');
}
