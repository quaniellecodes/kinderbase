import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { KioskScreen } from './KioskScreen';

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default async function KioskPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) redirect('/dashboard');

  const service = createServiceClient();

  const { data: center } = await service
    .from('centers')
    .select('id, name, organizations(primary_color)')
    .eq('id', active.centerId)
    .single();

  if (!center) redirect('/dashboard');

  const org = Array.isArray(center.organizations) ? center.organizations[0] : center.organizations;
  const primaryColor = org?.primary_color ?? '#D35400';

  return (
    <KioskScreen
      centerId={active.centerId}
      centerName={center.name}
      brandRgb={hexToRgb(primaryColor)}
    />
  );
}
