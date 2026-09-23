import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getOrgIconPublicUrl } from '@/lib/storage/org-icons';
import { Toaster } from '@/components/ui';
import { DemoBarMount } from '@/components/demo/DemoBarMount';
import { Sidebar } from '@/components/shell/Sidebar';
import { ResizableSidebar } from '@/components/shell/ResizableSidebar';
import { BottomNav } from '@/components/shell/BottomNav';
import type { CenterRole, ActiveContext } from '@kinderbase/types';

type Membership = {
  centerId: string;
  centerName: string;
  role: CenterRole;
};

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

async function getOrgTheme(centerId: string): Promise<{ brandRgb: string; iconUrl: string | null; centerName: string }> {
  const service = createServiceClient();
  const { data } = await service
    .from('centers')
    .select('name, organizations(primary_color, icon_path)')
    .eq('id', centerId)
    .single();
  const org = data?.organizations ? (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) : null;
  const color = org?.primary_color ?? '#D35400';
  const iconUrl = org?.icon_path ? getOrgIconPublicUrl(org.icon_path) : null;
  return { brandRgb: hexToRgb(color), iconUrl, centerName: data?.name ?? 'KinderBase' };
}

export async function generateMetadata(): Promise<Metadata> {
  const active = getActiveContextFromCookies();
  if (!active) return { title: 'KinderBase' };
  const { iconUrl, centerName } = await getOrgTheme(active.centerId);
  return {
    title: centerName,
    icons: iconUrl ? { icon: iconUrl } : undefined,
  };
}

async function getMemberships(userId: string): Promise<Membership[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('center_memberships')
    .select('role, centers(id, name)')
    .eq('user_id', userId)
    .is('left_at', null);

  if (!data) return [];

  return data.map((row) => {
    const center = Array.isArray(row.centers) ? row.centers[0] : row.centers;
    return {
      centerId: (center as { id: string; name: string } | null)?.id ?? '',
      centerName: (center as { id: string; name: string } | null)?.name ?? '',
      role: row.role as CenterRole,
    };
  });
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const memberships = await getMemberships(user.id);

  if (memberships.length === 0) {
    // User has no center memberships — show a holding page
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm text-gray-500">
            Your account isn&apos;t linked to any center yet. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  let active = getActiveContextFromCookies();

  // Auto-select if only one membership, or if saved context is stale
  if (!active || !memberships.some((m) => m.centerId === active!.centerId && m.role === active!.role)) {
    const first = memberships[0]!;
    active = { centerId: first.centerId, centerName: first.centerName, role: first.role };
    // Cookie writes require a Route Handler — redirect to set it, then come back
    redirect(`/api/init-context?ctx=${encodeURIComponent(JSON.stringify(active))}`);
  }

  const { brandRgb } = await getOrgTheme(active.centerId);

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ '--color-brand-rgb': brandRgb } as React.CSSProperties}>
      <ResizableSidebar><Sidebar /></ResizableSidebar>
      <main className="flex-1 flex flex-col min-w-0 pb-[56px] md:pb-0">
        {children}
      </main>
      <BottomNav memberships={memberships} active={active} />
      <Toaster />
      <DemoBarMount surface="desktop" />
    </div>
  );
}
